# QubeBase - Core Hub Database for AgentiQ Platform

**Production-grade Supabase backend** powering the Aigent Z ecosystem with multi-tenant isolation, encrypted file storage (BlakQube), compliance controls, billing with revenue sharing, and DID/FIO identity management.

## Architecture Overview

QubeBase provides a unified data layer for multiple apps:
- **Nakamoto**: Bitcoin-focused tools and services
- **Kn0w1**: Knowledge management and media feeds
- **Moneypenny**: Administrative and operational tools
- **AgentIQ**: Agentic AI orchestration

### Core Features

- **Multi-tenant isolation** via RLS policies with role-based access (Uber Admin, Franchise Admin, Site Admin, Editor, Viewer, End User)
- **BlakQube Phase-1**: Client-side envelope encryption, 25 MB soft / 250 MB hard caps per file
- **Compliance**: KYC attestations, jurisdiction blocking, PII masking
- **Billing & Rev-Share**: Attribution tracking (first-touch default), formula-based splits
- **DID/FIO**: Decentralized identity with default `@qripto` handles
- **A2A/MCP**: Tool and agent catalogs with quota-based invocations
- **Registry Mirror**: Template/instance model with blockchain proofs

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
/seed
  seed.sql                 # Test tenants, users, sites
/tests
  acceptance.http          # RLS and cap verification tests
```

## Schemas

| Schema | Purpose |
|--------|---------|
| `iam` | Users, tenants, sites, memberships |
| `crm` | Contacts, accounts, deals, activities |
| `registry_mirror` | Templates, instances, entitlements, proofs |
| `black` | Payloads, envelopes (encryption), chunks, derivatives |
| `media` | Assets, feed items, mint intents |
| `agentic` | Tools, agents, grants, invocations |
| `compliance` | KYC attestations, country blocks, jurisdiction policies |
| `billing` | Accounts, meters, invoices, line items, rev-share rules |
| `did` | Identities, personas, keys |
| `fio` | FIO handles (default: `@qripto`) |
| `ops` | Audit logs, access logs, analytics MVs |

## Environment Variables

See `.env.sample` for required variables:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- File size caps: `APP_FILE_SOFT_CAP_BYTES` (25 MB), `APP_FILE_HARD_CAP_BYTES` (250 MB)

## Edge Functions

### `upload_intake`
- Enforces 25 MB soft / 250 MB hard caps
- MIME validation, virus scanning (TODO)
- Creates `black.payloads`, `black.chunks`, `media.assets`
- Reads client-side envelope metadata

### `issue_signed_url`
- Sets `app.request_country` from request headers
- Calls `black.authorize_payload_download` RPC
- Issues short-lived signed URL from Supabase Storage
- Logs to `ops.access_log`

### `generate_derivatives`
- Ephemeral server-side decrypt (if policy allows)
- Generates thumbnails, preview clips
- Writes `black.derivatives`

### `registry_webhook`
- Verifies DVN/ICP signatures (TODO: actual verification)
- Upserts `registry_mirror.templates/instances/proofs/entitlements`
- Idempotency via `txid` or `instance_id`

### `ipfs_icp_connector` (Phase 2 stub)
- Manages `storage.replicas` table
- Handles prefetch/hydration state machine
- No external IPFS/ICP calls yet

### `analytics_refresh`
- Refreshes materialized views like `ops.mv_active_users_d`

## Security & RLS

- **Tenant isolation**: All tables filtered by `tenant_id` membership
- **Envelope encryption**: Sensitive files require `black.envelopes` grants
- **Compliance gating**: `compliance.can_download_payload()` checks country blocks
- **Audit trail**: `ops.audit_log` and `ops.access_log`

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

## Key RPCs

- `black.authorize_payload_download(p_payload_id uuid)` - Download authorization
- `black.share_payload(...)` - Grant access via wrapped DEK
- `black.revoke_payload(...)` - Revoke access
- `fio.bind_default_handle(p_persona_id uuid, p_username text)` - Assign `@qripto` handle
- `billing.apply_revshare_for_invoice(p_invoice_id uuid)` - Calculate rev-share splits

## Phase 2 Roadmap

- [ ] Hybrid storage connectors (IPFS, ICP, Arweave)
- [ ] Server-side re-encryption for tier migration
- [ ] DVN signature verification
- [ ] Multi-attribution models (last-touch, linear, time-decay)
- [ ] Enhanced compliance rules engine

## Support

For questions or issues, refer to the [Lovable Documentation](https://docs.lovable.dev/) or join the [Discord community](https://discord.com/channels/1119885301872070706/1280461670979993613).

---

**License**: MIT
