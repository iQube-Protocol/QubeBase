/**
 * Client-side envelope crypto + chunker for browsers (WebCrypto).
 * - AES-256-GCM DEK per payload
 * - Wrap DEK with KEK public key (RSA-OAEP or X25519/ECDH-ES)
 * - Encrypt a File/Blob stream into 8–16MB chunks with unique IVs and AAD
 */

export type Base64Url = string;
export type JWK = JsonWebKey;

export type EnvelopeOut = {
  key_ref: string;
  wrapped_dek: Base64Url;
  alg: 'AES-256-GCM';
  version: 1;
};

export type EncryptResult = {
  chunks: Array<{
    idx: number;
    iv_b64u: Base64Url;
    aad_b64u: Base64Url;
    bytes: Uint8Array;
    sha256_b64u: Base64Url;
  }>;
  dekRaw_b64u: Base64Url;
  dekKey: CryptoKey;
};

export type WrapOptions =
  | { mode: 'RSA-OAEP'; kekJwk: JWK; hash?: 'SHA-256' | 'SHA-512' }
  | { mode: 'ECDH-ES'; kekJwk: JWK; curve?: 'X25519' | 'P-256' };

const subtle = crypto.subtle;

// ---------- base64url helpers ----------
export function b64u(buf: ArrayBuffer | Uint8Array): Base64Url {
  const b = ArrayBuffer.isView(buf) ? buf as Uint8Array : new Uint8Array(buf as ArrayBuffer);
  let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function b64uToBytes(b64uStr: Base64Url): Uint8Array {
  const pad = '='.repeat((4 - (b64uStr.length % 4)) % 4);
  const b64 = b64uStr.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- hashing ----------
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const d = await subtle.digest('SHA-256', bytes as BufferSource);
  return new Uint8Array(d);
}

// ---------- DEK generation & import/export ----------
export async function genAesGcm256(): Promise<CryptoKey> {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportRaw(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await subtle.exportKey('raw', key));
}

export async function importRsaOaepPublic(jwk: JWK, hash: 'SHA-256' | 'SHA-512' = 'SHA-256'): Promise<CryptoKey> {
  return subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash }, true, ['encrypt']);
}

export async function importX25519Public(jwk: JWK): Promise<CryptoKey> {
  return subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'X25519' }, true, []);
}

// ---------- Wrap DEK with KEK ----------
export async function wrapDEK(
  dek: CryptoKey,
  keyRef: string,
  opts: WrapOptions
): Promise<EnvelopeOut> {
  const dekRaw = await exportRaw(dek);

  if (opts.mode === 'RSA-OAEP') {
    const pub = await importRsaOaepPublic(opts.kekJwk, opts.hash ?? 'SHA-256');
    const wrapped = await subtle.encrypt({ name: 'RSA-OAEP' }, pub, dekRaw as BufferSource);
    return { key_ref: keyRef, wrapped_dek: b64u(wrapped), alg: 'AES-256-GCM', version: 1 };
  }

  const curve = opts.curve ?? 'X25519';
  const kekPub = await subtle.importKey('jwk', opts.kekJwk, { name: 'ECDH', namedCurve: curve }, false, []);
  const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: curve }, true, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'ECDH', public: kekPub }, eph.privateKey, 256);
  const hkdfSalt = new Uint8Array(16); crypto.getRandomValues(hkdfSalt);
  const hkdfIKM = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  const kwKey = await subtle.deriveKey(
    { name: 'HKDF', salt: hkdfSalt as BufferSource, hash: 'SHA-256', info: new TextEncoder().encode('DEK-WRAP') },
    hkdfIKM,
    { name: 'AES-KW', length: 256 },
    true,
    ['wrapKey', 'unwrapKey']
  );
  const wrapped = await subtle.wrapKey('raw', dek, kwKey, 'AES-KW');
  const ephPubJwk = await subtle.exportKey('jwk', eph.publicKey);
  const payload = concatBytes(utf8(`EPH:${JSON.stringify(ephPubJwk)}|S:`), hkdfSalt, new Uint8Array(wrapped));
  return { key_ref: keyRef, wrapped_dek: b64u(payload), alg: 'AES-256-GCM', version: 1 };
}

// ---------- Chunked encryption ----------
export type EncryptChunksOpts = {
  file: Blob;
  dekKey?: CryptoKey;
  payloadId: string;
  chunkBytes?: number;
  startIdx?: number;
};

export async function encryptFileToChunks(
  { file, dekKey, payloadId, chunkBytes = 8 * 1024 * 1024, startIdx = 0 }: EncryptChunksOpts
): Promise<EncryptResult> {
  const dek = dekKey ?? await genAesGcm256();
  const chunks: EncryptResult['chunks'] = [];
  const reader = file.stream().getReader();

  let idx = startIdx;
  let carry = new Uint8Array(0);

  for (;;) {
    const { done, value } = await reader.read();
    const buf = value ? new Uint8Array(value) : new Uint8Array(0);
    const concat = concatBytes(carry, buf);
    if (done && concat.length === 0) break;

    let offset = 0;
    while (offset + chunkBytes <= concat.length) {
      const plain = concat.subarray(offset, offset + chunkBytes);
      const { iv, aad } = gcmParams(payloadId, idx);
      const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad as BufferSource, tagLength: 128 }, dek, plain as BufferSource));
      const hash = await sha256(ct);
      chunks.push({ idx, iv_b64u: b64u(iv), aad_b64u: b64u(aad), bytes: ct, sha256_b64u: b64u(hash) });
      idx++; offset += chunkBytes;
    }
    carry = concat.subarray(offset);
    if (done) {
      if (carry.length > 0) {
        const plain = carry;
        const { iv, aad } = gcmParams(payloadId, idx);
        const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad as BufferSource, tagLength: 128 }, dek, plain as BufferSource));
        const hash = await sha256(ct);
        chunks.push({ idx, iv_b64u: b64u(iv), aad_b64u: b64u(aad), bytes: ct, sha256_b64u: b64u(hash) });
        carry = new Uint8Array(0);
      }
      break;
    }
  }

  const dekRaw = await exportRaw(dek);
  return { chunks, dekRaw_b64u: b64u(dekRaw), dekKey: dek };
}

// ---------- Utils ----------
function gcmParams(payloadId: string, idx: number) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const aad = new TextEncoder().encode(`${payloadId}:${idx}`);
  return { iv, aad };
}

function concatBytes(...parts: Uint8Array[]) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function utf8(s: string) { return new TextEncoder().encode(s); }
