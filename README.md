# QubeBase - Core Hub Database for AgentiQ Platform

**Production-grade Supabase backend** powering the Aigent Z ecosystem with multi-tenant isolation, CRM, and Registry mirroring.

> **🚀 Current Implementation**: This is a **hybrid MVP** approach - core features are implemented with CRM and Registry mirroring, while advanced features (envelope encryption, billing) are deferred for Phase 2.

## Architecture Overview

QubeBase provides a unified data layer for multiple apps:
- **Nakamoto**: Bitcoin-focused tools and services
- **Kn0w1**: Knowledge management and media feeds
- **Moneypenny**: Administrative and operational tools
- **AgentIQ**: Agentic AI orchestration

### Core Features (Implemented ✅)

- **Multi-tenant isolation** via RLS policies with role-based access
- **CRM**: Contacts and accounts with tenant-scoped access
- **Registry Mirror**: Template/instance model with blockchain proofs and entitlements
- **Edge Functions**: Webhook integration for registry updates

### Deferred Features (Phase 2 📋)

The following features are documented but not yet implemented. They can be added incrementally as needed:

- **BlakQube Encryption**: Client-side envelope encryption with `blak.envelopes`, DEK wrapping, and secure sharing
- **Billing & Rev-Share**: Attribution tracking, formula-based splits, metering, and invoicing
- **Advanced Compliance**: KYC attestations, jurisdiction blocking, PII masking
- **DID/FIO**: Decentralized identity with FIO handles
- **A2A/MCP**: Tool and agent catalogs with quota-based invocations
- **Hybrid Storage**: IPFS, ICP, and Arweave connectors

---

## 📦 SDK Packages

QubeBase provides three installable SDK packages published under **`@qriptoagentiq/*`** for integration with Aigent Z and franchise agents (Kn0w1, Nakamoto, MoneyPenny):

### Available Packages

- **@qriptoagentiq/core-client** (v0.1.5): Core SDK with authentication, IAM, upload/storage, sharing, and metering
- **@qriptoagentiq/kn0w1-client** (v0.1.5): Kn0w1-specific client for feed and post management  
- **@qriptoagentiq/a2a-client** (v0.1.5): Agent-to-Agent communication client (scaffold)

### Install via npm (recommended after publication)

```bash
npm i @qriptoagentiq/core-client@^0.1.5 @qriptoagentiq/kn0w1-client@^0.1.5
# Peer dependency:
npm i @supabase/supabase-js@^2.75.0
```

### Install via tarballs (immediate installation)

For immediate installation before npm publication:

```bash
npm i ./releases/qriptoagentiq-core-client-0.1.5.tgz ./releases/qriptoagentiq-kn0w1-client-0.1.5.tgz
# Peer dependency:
npm i @supabase/supabase-js@^2.75.0
```

### Install from GitHub (alternative)

```bash
npm i https://raw.githubusercontent.com/iQube-Protocol/QubeBase/main/releases/qriptoagentiq-core-client-0.1.5.tgz \
      https://raw.githubusercontent.com/iQube-Protocol/QubeBase/main/releases/qriptoagentiq-kn0w1-client-0.1.5.tgz
# Peer dependency:
npm i @supabase/supabase-js@^2.75.0
```

See [releases/INSTALL.md](./releases/INSTALL.md) for detailed installation instructions.

### Usage Example

```typescript
import { initAgentiqClient } from "@qriptoagentiq/core-client";
import { Kn0w1Client } from "@qriptoagentiq/kn0w1-client";

// Initialize core client with Supabase credentials
const core = initAgentiqClient({
  url: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY
});

// Ensure IAM user exists
await core.ensureIamUser();

// Initialize Kn0w1 client with context
const kn0w1 = new Kn0w1Client(core, {
  tenantId: "your-tenant-id",
  siteId: "your-site-id"
});

// Fetch feed items
const feed = await kn0w1.feed(20);

// Upload sensitive post with encryption envelope
const payloadId = await kn0w1.uploadSensitivePost({
  instanceId: "instance-uuid",
  file: myFile,
  envelope: { key_ref: "...", wrapped_dek: "..." }
});

// Get signed URL for access
const url = await kn0w1.getSignedUrl(payloadId, "US");
```

---

## 🚀 Release Process

### Automatic Release (via Git Tags)

To release a new version, bump the version and push tags:

```bash
# Bump version for specific package
npm version patch -w @qriptoagentiq/core-client && git push --follow-tags
npm version patch -w @qriptoagentiq/kn0w1-client && git push --follow-tags
npm version patch -w @qriptoagentiq/a2a-client && git push --follow-tags
```

The CI workflow (`.github/workflows/release.yml`) will automatically:
1. Build all SDK packages
2. Run tests  
3. Compare versions with npm registry
4. Publish changed packages (requires `NPM_TOKEN` secret in GitHub Actions)

CI is triggered by scoped tags matching:
- `@qriptoagentiq/core-client@*`
- `@qriptoagentiq/kn0w1-client@*`
- `@qriptoagentiq/a2a-client@*`

### Manual Release (via GitHub UI)

A manual workflow (`.github/workflows/release-manual.yml`) is available for publishing from the GitHub Actions tab:

1. Go to **Actions** → **Manual Publish**
2. Click **Run workflow**
3. Select package and enter new version (e.g., `0.1.6`)
4. The workflow will bump, tag, and publish

### Local Development

```bash
# Build SDK packages
npm run build:sdk

# Build SDK + generate tarballs
npm run build:all

# Publish changed packages (requires NPM_TOKEN)
npm run publish:changed
```

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase CLI: `npm install -g supabase`

### Local Development

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd qubebase

# 2. Copy environment template
cp .env.sample .env

# 3. Start Supabase locally
supabase start

# 4. Apply migrations
supabase db reset

# 5. (Optional) Load seed data
psql postgresql://postgres:postgres@localhost:54322/postgres < seed/seed.sql

# 6. Run Edge Functions locally
supabase functions serve --env-file .env
```

### Generate TypeScript Types

```bash
supabase gen types typescript --project-id <project-id> > src/lib/database.types.ts
```

## Project Structure

```
/supabase
  /migrations
    000_init.sql           # Complete schema DDL, RLS policies, RPCs
  /functions
    /upload_intake         # File upload with cap enforcement
    /issue_signed_url      # Authorized download URL generation
    /generate_derivatives  # Thumbnail/preview creation
    /registry_webhook      # DVN/ICP template/instance sync
    /ipfs_icp_connector    # Phase-2 hybrid storage (stub)
    /analytics_refresh     # Materialized view refresh
/packages
  /core-client            # Core SDK package
  /kn0w1-client          # Kn0w1 SDK package
  /a2a-client            # A2A SDK package
/releases
  *.tgz                   # Pre-built SDK tarballs
  INSTALL.md              # Installation guide
/seed
  seed.sql                # Test tenants, users, sites
/tests
  acceptance.http         # RLS and cap verification tests
```

## Schemas

| Schema | Status | Purpose |
|--------|--------|---------|
| `public` | ✅ Implemented | Core tables: tenants, sites, roles, user_roles |
| `crm` | ✅ Implemented | Contacts and accounts with tenant isolation |
| `registry_mirror` | ✅ Implemented | Templates, instances, entitlements, proofs |
| `blak` | 📋 Phase 2 | Payloads, envelopes (encryption), chunks, derivatives |
| `media` | 📋 Phase 2 | Assets, feed items, mint intents |
| `agentic` | 📋 Phase 2 | Tools, agents, grants, invocations |
| `compliance` | 📋 Phase 2 | KYC attestations, country blocks, jurisdiction policies |
| `billing` | 📋 Phase 2 | Accounts, meters, invoices, line items, rev-share rules |
| `did` | 📋 Phase 2 | Identities, personas, keys |
| `fio` | 📋 Phase 2 | FIO handles (default: `@qripto`) |
| `ops` | 📋 Phase 2 | Audit logs, access logs, analytics MVs |

## Environment Variables

See `.env.sample` for required variables:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- File size caps: `APP_FILE_SOFT_CAP_BYTES` (25 MB), `APP_FILE_HARD_CAP_BYTES` (250 MB)

## Edge Functions

### `registry_webhook` ✅
**Status**: Implemented and ready to use

- Receives webhook events from external registry (DVN/ICP)
- Upserts `registry_mirror.templates`, `instances`, `proofs`, and `entitlements`
- Handles event types: `template.upsert`, `instance.upsert`, `proof.append`, `entitlement.grant`
- Uses service role for database writes
- TODO: Add signature verification for webhook security

### `upload_intake` 📋
**Status**: Phase 2 - Requires `blak.payloads` schema

- Will enforce 25 MB soft / 250 MB hard caps
- MIME validation, virus scanning
- Creates `blak.payloads`, `blak.chunks`, `media.assets`

### `issue_signed_url` 📋
**Status**: Phase 2 - Requires envelope encryption schema

- Will authorize downloads via `blak.authorize_payload_download` RPC
- Issue short-lived signed URLs from Supabase Storage
- Country-based access control

### `generate_derivatives` 📋
**Status**: Phase 2 - Requires encryption and derivatives schema

- Will generate thumbnails and preview clips
- Ephemeral server-side decryption

### `ipfs_icp_connector` 📋
**Status**: Phase 2 - Hybrid storage connector

- Will manage IPFS/ICP replication
- Prefetch/hydration state machine

### `analytics_refresh` 📋
**Status**: Phase 2 - Requires ops schema

- Will refresh materialized views for analytics

## Security & RLS

### Current Implementation ✅
- **Tenant isolation**: All CRM and registry tables filtered by tenant membership via RLS
- **Role-based access**: Users must have roles in `user_roles` to access tenant data
- **Public registry data**: Templates, instances, and proofs are publicly readable (by design)
- **Tenant-scoped entitlements**: Only users in the entitlement's tenant can view it

### Phase 2 Security Features 📋
- **Envelope encryption**: Will require `blak.envelopes` grants for file access
- **Compliance gating**: Will check country blocks via `compliance.can_download_payload()`
- **Audit trail**: Will log all access to `ops.audit_log` and `ops.access_log`

## Testing

Run acceptance tests to verify:
- RLS isolation (user A can't see tenant B data)
- Payload gating (no envelope grant → 403)
- Jurisdiction blocks (blocked country → 403)
- Billing/rev-share calculations

```bash
# Using REST client (VS Code extension) or curl
# See tests/acceptance.http
```

## Phase 2 Roadmap

When you're ready to add these features, here's the implementation order we recommend:

### 1. BlakQube Encryption (`blak` schema)
- [ ] Add `blak.payloads`, `blak.envelopes`, `blak.chunks`, `blak.derivatives` tables
- [ ] Implement `upload_intake` edge function with file caps
- [ ] Add `blak.authorize_payload_download()` RPC
- [ ] Add `blak.share_payload()` and `blak.revoke_payload()` RPCs
- [ ] Enable `issue_signed_url` and `generate_derivatives` functions

### 2. Billing & Rev-Share (`billing` schema)
- [ ] Add `billing.accounts`, `billing.meters`, `billing.invoices`, `billing.line_items` tables
- [ ] Add `billing.revshare_rules`, `billing.revshare_splits`, `billing.attribution_models` tables
- [ ] Implement `billing.apply_revshare_for_invoice()` RPC
- [ ] Add metering and invoice generation logic

### 3. Compliance (`compliance` schema)
- [ ] Add `compliance.kyc_levels`, `compliance.kyc_attestations` tables
- [ ] Add `compliance.jurisdiction_policies`, `compliance.country_blocks` tables
- [ ] Implement `compliance.can_download_payload()` RPC
- [ ] Add PII masking functions

### 4. DID/FIO Identity (`did` and `fio` schemas)
- [ ] Add `did.identities`, `did.personas`, `did.keys` tables
- [ ] Add `fio.handles` table with `@qripto` default
- [ ] Implement `fio.bind_default_handle()` RPC

### 5. A2A/MCP Agentic (`agentic` schema)
- [ ] Add `agentic.tools`, `agentic.agents`, `agentic.grants` tables
- [ ] Add `agentic.invocations` for quota tracking
- [ ] Implement agent catalog and invocation metering

### 6. Hybrid Storage
- [ ] Implement `ipfs_icp_connector` edge function
- [ ] Add `storage.replicas` state machine
- [ ] Add support for Arweave and other providers

### 7. Operations & Analytics (`ops` schema)
- [ ] Add `ops.audit_log` and `ops.access_log` tables
- [ ] Add materialized views like `ops.mv_active_users_d`
- [ ] Enable `analytics_refresh` function

## Support

For questions or issues, refer to the [Lovable Documentation](https://docs.lovable.dev/) or join the [Discord community](https://discord.com/channels/1119885301872070706/1280461670979993613).

---

**License**: MIT
