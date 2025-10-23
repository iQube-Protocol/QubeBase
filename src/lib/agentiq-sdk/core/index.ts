import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------- Types ----------
export type AgentiqContext = {
  tenantId: string;
  siteId?: string;
  isoCountry?: string; // pass to issue_signed_url
};

export type Envelope = {
  key_ref: string;
  wrapped_dek: string; // base64
  alg?: string;        // AES-256-GCM default
  version?: number;    // 1 default
};

// ---------- Init ----------
export function initAgentiqClient(opts?: { url?: string; anonKey?: string }) {
  const supabase = createClient(
    opts?.url ?? (import.meta as any).env?.VITE_SUPABASE_URL,
    opts?.anonKey ?? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
  );
  return new AgentiqCore(supabase);
}

export class AgentiqCore {
  constructor(public supabase: SupabaseClient) {}

  // 1) Mirror auth.user → iam.users (idempotent)
  async ensureIamUser() {
    const { data: au } = await this.supabase.auth.getUser();
    const user = au?.user;
    if (!user) throw new Error("Not authenticated");
    await this.supabase.from("iam.users")
      .upsert({ id: user.id, email: user.email ?? null })
      .select().maybeSingle();
    return user.id;
  }

  // 2) Resolve tenants/sites
  async myTenants(): Promise<string[]> {
    const uid = (await this.supabase.auth.getUser()).data.user?.id!;
    const { data, error } = await this.supabase.rpc("tenants_for_user", { uid });
    if (error) throw error;
    return data as string[];
  }

  // 3) Upload intake (register payload + optional envelope)
  async uploadIntake(args: {
    ctx: AgentiqContext;
    instanceId: string;
    file: { name: string; size: number; type: string };
    storageUri?: string;       // bucket/path; default blakqube/<uuid>/<file>
    sensitive?: boolean;       // default true
    envelope?: Envelope;       // required if sensitive=true
  }) {
    const storageUri = args.storageUri ?? `blakqube/${crypto.randomUUID()}/${args.file.name}`;
    const body = {
      instance_id: args.instanceId,
      tenant_id: args.ctx.tenantId,
      site_id: args.ctx.siteId,
      class_: args.sensitive === false ? "standard" : "sensitive",
      size_bytes: args.file.size,
      mime: args.file.type || "application/octet-stream",
      storage_uri: storageUri,
      envelope: args.sensitive === false ? undefined : args.envelope,
    };
    const res = await fetch("/functions/v1/upload_intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "upload_intake failed");
    return { payloadId: j.payload_id as string, storageUri, note: j.note as string };
  }

  // 4) Storage upload helper (simple, one-shot). For big files, do chunking client-side.
  async uploadToStorage(storageUri: string, file: File | Blob) {
    const [bucket, ...rest] = storageUri.split("/");
    const objectPath = rest.join("/");
    const up = await this.supabase.storage.from(bucket).upload(objectPath, file, { upsert: true });
    if (up.error) throw up.error;
    return up.data.path;
  }

  // 5) Signed URL after RLS+compliance gate
  async signedUrl(args: { payloadId: string; isoCountry?: string; bucketOverride?: string }) {
    const res = await fetch("/functions/v1/issue_signed_url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload_id: args.payloadId, country: args.isoCountry, bucket: args.bucketOverride }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "issue_signed_url failed");
    return j.signed_url as string;
  }

  // 6) Share / revoke (wrapped DEKs)
  async sharePayload(args: {
    payloadId: string;
    subjectType: "user" | "tenant" | "persona";
    subjectId: string;
    envelope: Envelope;
  }) {
    const { error } = await this.supabase.rpc("blak.share_payload", {
      p_payload_id: args.payloadId,
      p_subject_type: args.subjectType,
      p_subject_id: args.subjectId,
      p_key_ref: args.envelope.key_ref,
      p_wrapped_dek: args.envelope.wrapped_dek,
    });
    if (error) throw error;
  }

  async revokePayload(args: {
    payloadId: string;
    subjectType: "user" | "tenant" | "persona";
    subjectId: string;
  }) {
    const { error } = await this.supabase.rpc("blak.revoke_payload", {
      p_payload_id: args.payloadId,
      p_subject_type: args.subjectType,
      p_subject_id: args.subjectId,
    });
    if (error) throw error;
  }

  // 7) CRM: my contacts (via view)
  async myContacts() {
    return this.supabase.from("app_shared.v_my_contacts").select("*").then(r => {
      if (r.error) throw r.error;
      return r.data;
    });
  }

  // 8) Feed (Kn0w1 view)
  async kn0w1Feed(limit = 20) {
    const { data, error } = await this.supabase.from("app_kn0w1.v_feed")
      .select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  }

  // 9) Emit meter (deferred billing, but capture usage now)
  async emitMeter(args: { subjectType: "user"|"tenant"|"site"; subjectId: string; metric: string; qty: number; sku?: string; ts?: string }) {
    const { error } = await this.supabase.from("billing.meters").insert({
      subject_type: args.subjectType, subject_id: args.subjectId,
      metric: args.metric, qty: args.qty, sku: args.sku, ts: args.ts ?? new Date().toISOString()
    });
    if (error) throw error;
  }

  // 10) FIO default handle for @qripto (usually server-side, but exposed here for convenience)
  async bindFioHandle(personaId: string, username: string) {
    const { data, error } = await this.supabase.rpc("fio.bind_default_handle", { p_persona_id: personaId, p_username: username });
    if (error) throw error;
    return data as string; // "<username>@qripto"
  }
}
