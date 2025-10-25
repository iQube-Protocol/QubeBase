# @qriptoagentiq/core-client

Core SDK for interacting with the AgentiQ platform, providing authentication, data intake, storage, and sharing capabilities.

## Installation

```bash
npm install @qriptoagentiq/core-client @supabase/supabase-js@^2.75.0
```

## Quick Start

```typescript
import { initAgentiqClient } from "@qriptoagentiq/core-client";

// Initialize the client
const core = initAgentiqClient({
  url: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY
});

// Ensure IAM user exists
const userId = await core.ensureIamUser();
```

## API Reference

### Initialization

#### `initAgentiqClient(opts?: { url?: string; anonKey?: string }): AgentiqCore`

Initializes the AgentiQ client with Supabase configuration.

**Parameters:**
- `url` (optional): Supabase URL. Defaults to `SUPABASE_URL` environment variable.
- `anonKey` (optional): Supabase anonymous key. Defaults to `SUPABASE_ANON_KEY` environment variable.

**Returns:** `AgentiqCore` instance

### Core Methods

#### `ensureIamUser(): Promise<string>`

Ensures the authenticated user exists in the IAM system. Creates the user if they don't exist.

**Returns:** User ID (UUID)

**Example:**
```typescript
const userId = await core.ensureIamUser();
console.log("User ID:", userId);
```

---

#### `myTenants(): Promise<string[]>`

Retrieves all tenant IDs associated with the current user.

**Returns:** Array of tenant IDs

**Example:**
```typescript
const tenants = await core.myTenants();
console.log("User belongs to tenants:", tenants);
```

---

#### `uploadIntake(args: UploadIntakeArgs): Promise<UploadIntakeResult>`

Uploads intake data to storage and registers it in the system. Supports sensitive data with envelope encryption.

**Parameters:**
```typescript
interface UploadIntakeArgs {
  ctx: AgentiqContext;           // Tenant and site context
  instanceId: string;             // Unique instance identifier
  file: {
    name: string;
    size: number;
    type: string;
  };
  storageUri?: string;            // Optional custom storage URI
  sensitive?: boolean;            // Mark as sensitive data
  envelope?: Envelope;            // Encryption envelope for sensitive data
}

interface AgentiqContext {
  tenantId: string;
  siteId?: string;
  isoCountry?: string;
}

interface Envelope {
  key_ref: string;                // Reference to encryption key
  wrapped_dek: string;            // Wrapped data encryption key
}
```

**Returns:**
```typescript
interface UploadIntakeResult {
  payloadId: string;              // ID of uploaded payload
  storageUri: string;             // Storage URI for file upload
  note: string;                   // Status message
}
```

**Example:**
```typescript
const result = await core.uploadIntake({
  ctx: { tenantId: "tenant-123", siteId: "site-456" },
  instanceId: "upload-001",
  file: {
    name: "document.pdf",
    size: 1024000,
    type: "application/pdf"
  },
  sensitive: true,
  envelope: {
    key_ref: "key-ref-123",
    wrapped_dek: "encrypted-dek-data"
  }
});

// Upload the actual file
await core.uploadToStorage(result.storageUri, fileBlob);
```

---

#### `uploadToStorage(storageUri: string, file: File | Blob): Promise<string | null>`

Uploads a file directly to Supabase storage.

**Parameters:**
- `storageUri`: Storage path (format: `bucket-name/path/to/file`)
- `file`: File or Blob to upload

**Returns:** Public URL or null on error

**Example:**
```typescript
const url = await core.uploadToStorage(
  "uploads/documents/file.pdf",
  fileBlob
);
```

---

#### `signedUrl(args: SignedUrlArgs): Promise<string>`

Generates a signed URL for secure access to a payload.

**Parameters:**
```typescript
interface SignedUrlArgs {
  payloadId: string;
  isoCountry?: string;            // Optional country code for geo-routing
  bucketOverride?: string;        // Optional bucket name override
}
```

**Returns:** Signed URL string

**Example:**
```typescript
const url = await core.signedUrl({
  payloadId: "payload-123",
  isoCountry: "US"
});
```

---

#### `sharePayload(args: SharePayloadArgs): Promise<void>`

Shares a payload with a specified subject (user, tenant, or persona) using envelope encryption.

**Parameters:**
```typescript
interface SharePayloadArgs {
  payloadId: string;
  subjectType: "user" | "tenant" | "persona";
  subjectId: string;
  envelope: Envelope;             // Encrypted DEK for the subject
}
```

**Example:**
```typescript
await core.sharePayload({
  payloadId: "payload-123",
  subjectType: "tenant",
  subjectId: "tenant-456",
  envelope: {
    key_ref: "tenant-key-ref",
    wrapped_dek: "encrypted-dek-for-tenant"
  }
});
```

---

#### `revokePayload(args: RevokePayloadArgs): Promise<void>`

Revokes access to a payload for a specified subject.

**Parameters:**
```typescript
interface RevokePayloadArgs {
  payloadId: string;
  subjectType: "user" | "tenant" | "persona";
  subjectId: string;
}
```

**Example:**
```typescript
await core.revokePayload({
  payloadId: "payload-123",
  subjectType: "user",
  subjectId: "user-789"
});
```

---

#### `myContacts(): Promise<any>`

Retrieves the current user's contacts from CRM.

**Returns:** Array of contact records

**Example:**
```typescript
const contacts = await core.myContacts();
```

---

#### `kn0w1Feed(limit?: number): Promise<any[]>`

Fetches items from the Kn0w1 feed.

**Parameters:**
- `limit` (optional): Maximum number of items to fetch. Default: 20

**Returns:** Array of feed items

**Example:**
```typescript
const feed = await core.kn0w1Feed(50);
```

---

#### `emitMeter(args: EmitMeterArgs): Promise<void>`

Records usage metrics for billing purposes.

**Parameters:**
```typescript
interface EmitMeterArgs {
  subjectType: "user" | "tenant" | "site";
  subjectId: string;
  metric: string;                 // Metric name (e.g., "api_calls", "storage_gb")
  qty: number;                    // Quantity
  sku?: string;                   // Optional SKU identifier
  ts?: string;                    // Optional timestamp (ISO 8601)
}
```

**Example:**
```typescript
await core.emitMeter({
  subjectType: "tenant",
  subjectId: "tenant-123",
  metric: "api_calls",
  qty: 100,
  sku: "premium-plan"
});
```

---

#### `bindFioHandle(personaId: string, username: string): Promise<string>`

Binds a FIO handle to a persona for decentralized identity.

**Parameters:**
- `personaId`: Persona UUID
- `username`: FIO username

**Returns:** Binding confirmation message

**Example:**
```typescript
const result = await core.bindFioHandle(
  "persona-123",
  "user@fio"
);
```

---

## Envelope Encryption

For sensitive data, use the envelope encryption utilities:

```typescript
import { encryptFileToChunks, wrapDEK } from "@qriptoagentiq/core-client/crypto/envelope";

// Encrypt file
const { chunks, dek } = await encryptFileToChunks({
  blob: fileBlob,
  chunkSize: 8 * 1024 * 1024  // 8MB chunks
});

// Wrap DEK with recipient's public key
const envelope = await wrapDEK(dek, {
  mode: "rsa-oaep",
  publicKeyJwk: recipientPublicKey
});

// Upload with envelope
const result = await core.uploadIntake({
  ctx: { tenantId: "tenant-123" },
  instanceId: "secure-upload-001",
  file: { name: "secret.pdf", size: fileBlob.size, type: fileBlob.type },
  sensitive: true,
  envelope
});
```

## Complete Example

```typescript
import { initAgentiqClient } from "@qriptoagentiq/core-client";

async function uploadSecureDocument(file: File) {
  // Initialize client
  const core = initAgentiqClient({
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
  });

  // Ensure user exists
  await core.ensureIamUser();

  // Get user's tenants
  const tenants = await core.myTenants();
  const tenantId = tenants[0];

  // Upload intake record
  const result = await core.uploadIntake({
    ctx: { tenantId },
    instanceId: `upload-${Date.now()}`,
    file: {
      name: file.name,
      size: file.size,
      type: file.type
    }
  });

  // Upload actual file
  await core.uploadToStorage(result.storageUri, file);

  // Get signed URL for access
  const url = await core.signedUrl({
    payloadId: result.payloadId
  });

  // Record usage
  await core.emitMeter({
    subjectType: "tenant",
    subjectId: tenantId,
    metric: "file_uploads",
    qty: 1
  });

  return { payloadId: result.payloadId, url };
}
```

## TypeScript Support

Full TypeScript definitions are included. Import types as needed:

```typescript
import type { AgentiqCore, AgentiqContext, Envelope } from "@qriptoagentiq/core-client";
```

## Requirements

- Node.js 18+ or modern browser with ES2020+ support
- @supabase/supabase-js ^2.75.0 (peer dependency)

## License

See package repository for license information.
