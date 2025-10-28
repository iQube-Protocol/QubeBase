# QubeBase - Supabase Developer Guide for AI Models

**Last Updated**: October 2025  
**Project**: QubeBase - Core Hub Database for AgentiQ Platform  
**Supabase Project ID**: `iqjjctrgwafkbpdotflw`  
**Repository**: https://github.com/iQube-Protocol/QubeBase

---

## 🎯 Purpose of This Document

This guide is specifically designed for AI models working directly in the Supabase dashboard to understand the QubeBase database architecture, make schema modifications, write queries, and maintain the system. It provides everything needed to work confidently with the database without requiring access to the full codebase.

---

## 📋 Executive Summary

**QubeBase** is a production-grade Supabase backend powering the **Aigent Z ecosystem** with:
- **Multi-tenant isolation** via Row-Level Security (RLS)
- **CRM capabilities** for contacts and accounts
- **Registry mirroring** for blockchain templates and instances
- **DiDQube identity system** for decentralized identity management
- **SDK packages** for TypeScript/JavaScript integration
- **Edge Functions** for webhooks and file processing

### Current Implementation Status

✅ **Fully Implemented (Production Ready)**:
- Multi-tenant architecture with RLS
- CRM schema (contacts, accounts)
- Registry mirror schema (templates, instances, proofs, entitlements)
- DiDQube identity schema (kybe_identity, root_identity, persona)
- Core edge functions (registry_webhook, nakamoto_import)
- Three SDK packages (@qriptoagentiq/core-client, kn0w1-client, a2a-client)

📋 **Phase 2 (Documented but Not Yet Implemented)**:
- BlakQube encryption (envelope encryption, client-side crypto)
- Billing & revenue sharing
- Advanced compliance (KYC, jurisdiction blocking)
- DID/FIO integration
- A2A/MCP agent catalogs
- Hybrid storage (IPFS, ICP, Arweave)

---

## 🗄️ Database Schema Overview

### Current Schemas in Production

| Schema | Tables | Purpose | RLS Status |
|--------|--------|---------|------------|
| `public` | tenants, sites, roles, user_roles, kybe_identity, root_identity, persona, persona_agent_binding, hcp_profile | Core multi-tenant and identity | ✅ Enabled |
| `crm` | contacts, accounts | Customer relationship management | ✅ Enabled |
| `registry_mirror` | templates, instances, proofs, entitlements | Blockchain registry data | ✅ Enabled |
| `black` | payloads, payload_grants | File storage metadata (partial) | ✅ Enabled |
| `compliance` | country_blocks | Geo-blocking rules | ✅ Enabled |

### Schema: `public` (Core Multi-Tenant)

#### Table: `tenants`
Multi-tenant isolation root. Each tenant represents a separate organization.

```sql
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Purpose**: Root entity for tenant isolation  
**RLS**: Enabled - users can only see tenants they belong to  
**Key Relationships**: Referenced by sites, roles, user_roles

#### Table: `sites`
Sites belong to tenants and represent sub-organizations or apps.

```sql
CREATE TABLE public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Purpose**: Sub-organizations within a tenant  
**RLS**: Enabled - filtered by tenant membership

#### Table: `roles`
Tenant-scoped roles for RBAC.

```sql
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);
```

**Purpose**: Role definitions per tenant  
**RLS**: Enabled - scoped to tenant  
**Common Roles**: user, admin, super_admin, uber_admin

#### Table: `user_roles`
Maps auth users to roles.

```sql
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role_id)
);
```

**Purpose**: User-role assignments  
**RLS**: Enabled - users can read their own roles  
**Security**: UPDATE operations blocked to prevent privilege escalation

---

### Schema: `public` (DiDQube Identity System)

#### Table: `kybe_identity`
Root identity with World ID integration and soul key encryption.

```sql
CREATE TABLE public.kybe_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kybe_did TEXT UNIQUE NOT NULL,
    encrypted_soul_key TEXT,
    state TEXT CHECK (state IN ('active', 'revoked', 'deceased')) DEFAULT 'active',
    issued_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Root identity for DiDQube system  
**RLS**: Enabled  
**Key Fields**:
- `kybe_did`: Unique DID (Decentralized Identifier)
- `encrypted_soul_key`: Encrypted master key for identity
- `state`: Lifecycle state (active/revoked/deceased)

#### Table: `root_identity`
Persona root identities linked to kybe identities.

```sql
CREATE TABLE public.root_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kybe_id UUID REFERENCES public.kybe_identity(id) ON DELETE SET NULL,
    kybe_hash TEXT,
    did_uri TEXT UNIQUE NOT NULL,
    kyc_status TEXT CHECK (kyc_status IN ('unverified', 'kycd', 'revoked')) DEFAULT 'unverified',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Root persona identity  
**RLS**: Enabled  
**Key Fields**:
- `did_uri`: Unique DID URI
- `kyc_status`: KYC verification state

#### Table: `persona`
User personas with FIO handles and identity states.

```sql
CREATE TABLE public.persona (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    root_id UUID REFERENCES public.root_identity(id) ON DELETE SET NULL,
    fio_handle TEXT,
    default_identity_state TEXT CHECK (default_identity_state IN 
        ('anonymous', 'semi_anonymous', 'semi_identifiable', 'identifiable')) 
        NOT NULL DEFAULT 'semi_anonymous',
    app_origin TEXT,
    world_id_status TEXT CHECK (world_id_status IN 
        ('unverified', 'verified_human', 'agent_declared')) 
        DEFAULT 'unverified',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: User personas for different identity contexts  
**RLS**: Enabled - permissive read, authenticated insert  
**Key Fields**:
- `fio_handle`: FIO protocol handle (e.g., "user@fio")
- `default_identity_state`: Privacy level
- `world_id_status`: World ID verification status

#### Table: `persona_agent_binding`
Links personas to AI agents.

```sql
CREATE TABLE public.persona_agent_binding (
    persona_id UUID REFERENCES public.persona(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (persona_id, agent_id)
);
```

**Purpose**: Persona-to-agent associations  
**RLS**: Enabled

#### Table: `hcp_profile`
Human-Centric Profile data with preferences and scopes.

```sql
CREATE TABLE public.hcp_profile (
    persona_id UUID PRIMARY KEY REFERENCES public.persona(id) ON DELETE CASCADE,
    preference_ptr TEXT,
    scopes JSONB,
    revocation JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Privacy preferences and consent management  
**RLS**: Enabled  
**Key Fields**:
- `scopes`: JSON permissions/scopes
- `revocation`: JSON revocation data

---

### Schema: `crm`

#### Table: `crm.contacts`
Contact records with tenant isolation.

```sql
CREATE TABLE crm.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID
);
```

**Purpose**: CRM contact management  
**RLS**: Enabled - filtered by tenant membership  
**Indexes**: tenant_id, email

#### Table: `crm.accounts`
Account/organization records.

```sql
CREATE TABLE crm.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    domain TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Account/organization tracking  
**RLS**: Enabled - tenant-scoped

---

### Schema: `registry_mirror`

Mirrors blockchain registry data (templates, instances, proofs, entitlements).

#### Table: `registry_mirror.templates`
Template definitions from blockchain.

```sql
CREATE TABLE registry_mirror.templates (
    id UUID PRIMARY KEY,
    template_id TEXT UNIQUE NOT NULL,
    name TEXT,
    description TEXT,
    schema_uri TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Template definitions from DVN/ICP  
**RLS**: Enabled - public read access

#### Table: `registry_mirror.instances`
Template instances.

```sql
CREATE TABLE registry_mirror.instances (
    id UUID PRIMARY KEY,
    instance_id TEXT UNIQUE NOT NULL,
    template_id UUID REFERENCES registry_mirror.templates(id),
    owner_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Instances of templates  
**RLS**: Enabled - public read access

#### Table: `registry_mirror.proofs`
Blockchain proofs for instances.

```sql
CREATE TABLE registry_mirror.proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID REFERENCES registry_mirror.instances(id),
    proof_type TEXT,
    proof_data JSONB,
    block_height BIGINT,
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Blockchain verification proofs  
**RLS**: Enabled

#### Table: `registry_mirror.entitlements`
Access entitlements for instances.

```sql
CREATE TABLE registry_mirror.entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID REFERENCES registry_mirror.instances(id),
    user_id TEXT,
    entitlement_type TEXT,
    granted_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);
```

**Purpose**: User entitlements to instances  
**RLS**: Enabled

---

### Schema: `black` (Partial - Phase 2)

#### Table: `black.payloads`
File/data payload metadata.

```sql
CREATE TABLE black.payloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    file_size_bytes BIGINT NOT NULL,
    content_type TEXT,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID NOT NULL
);
```

**Purpose**: File upload metadata  
**RLS**: Enabled - tenant-scoped  
**Note**: Part of Phase 2 encryption features

#### Table: `black.payload_grants`
Access grants for payloads.

```sql
CREATE TABLE black.payload_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload_id UUID REFERENCES black.payloads(id) ON DELETE CASCADE,
    grantee_user_id UUID NOT NULL,
    granted_by UUID NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    UNIQUE(payload_id, grantee_user_id)
);
```

**Purpose**: Manage payload access  
**RLS**: Enabled

---

### Schema: `compliance`

#### Table: `compliance.country_blocks`
Geo-blocking rules per tenant.

```sql
CREATE TABLE compliance.country_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    country_code TEXT NOT NULL,
    blocked BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, country_code)
);
```

**Purpose**: Country-level access blocking  
**RLS**: Enabled

---

## 🔐 Security Architecture

### Row-Level Security (RLS) Coverage

**100% RLS Coverage**: All 14+ production tables have RLS enabled with 46+ policies.

### Key Security Functions

#### `public.has_role(_user_id uuid, _role app_role) RETURNS boolean`
Checks if a user has a specific role. Uses SECURITY DEFINER to avoid RLS recursion.

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

#### `compliance.can_download_payload(p_payload_id uuid, p_user_id uuid, p_country_code text) RETURNS boolean`
Authorizes payload downloads based on grants and geo-blocking.

**Logic**:
1. Check if country is blocked for the tenant
2. Check if user has a valid grant for the payload
3. Return true only if not blocked AND has grant

---

## 🔧 Edge Functions

### `registry_webhook` ✅ Production Ready
**Purpose**: Receives webhooks from external blockchain registry (DVN/ICP)  
**Location**: `supabase/functions/registry_webhook/index.ts`

**Event Types**:
- `template.upsert` - Create/update template
- `instance.upsert` - Create/update instance
- `proof.append` - Add blockchain proof
- `entitlement.grant` - Grant access entitlement

**Security**:
- HMAC signature verification (constant-time comparison)
- Replay attack prevention (5-minute timestamp window)
- Zod input validation
- Uses service role for database writes

**Request Format**:
```json
{
  "event_type": "template.upsert",
  "timestamp": "2025-10-28T10:30:00Z",
  "data": {
    "template_id": "template-123",
    "name": "Example Template",
    "description": "Template description",
    "schema_uri": "https://..."
  }
}
```

### `nakamoto_import` ✅ Production Ready
**Purpose**: Imports user data from Nakamoto system  
**Location**: `supabase/functions/nakamoto_import/index.ts`

**Imports**:
- Users with invitation status
- Interaction history
- Knowledge base documents
- System prompts
- Persona data (KNYT/Qripto)
- Connection data (LinkedIn, wallets, etc.)

**Request Format**: See `NAKAMOTO_IMPORT_FORMAT.md` for complete specification

### `upload_intake` 📋 Phase 2
**Purpose**: File upload with cap enforcement  
**Status**: Documented, awaiting `blak.payloads` full schema

**Features**:
- Rate limiting: 100 uploads/hour per tenant
- File size limits: 500MB soft, 1GB hard
- MIME type validation
- Path traversal prevention
- Filename sanitization

### `issue_signed_url` 📋 Phase 2
**Purpose**: Generate signed URLs for secure downloads  
**Status**: Awaits envelope encryption schema

**Features**:
- Authorization via `compliance.can_download_payload()`
- Short-lived URLs (60 seconds)
- Country-based access control

### `generate_derivatives` 📋 Phase 2
**Purpose**: Generate thumbnails and previews  
**Status**: Phase 2

### `ipfs_icp_connector` 📋 Phase 2
**Purpose**: IPFS/ICP replication  
**Status**: Phase 2 - Hybrid storage connector

### `analytics_refresh` 📋 Phase 2
**Purpose**: Refresh materialized views  
**Status**: Phase 2 - Requires ops schema

---

## 🔄 Common Database Operations

### Create a New Tenant

```sql
-- Insert tenant
INSERT INTO public.tenants (name)
VALUES ('New Company Inc.')
RETURNING id, name, created_at;

-- Create default roles for the tenant
INSERT INTO public.roles (tenant_id, name)
SELECT 
  (SELECT id FROM public.tenants WHERE name = 'New Company Inc.'),
  unnest(ARRAY['user', 'admin', 'super_admin'])
RETURNING *;
```

### Assign User to Tenant with Role

```sql
-- Assign admin role to user
INSERT INTO public.user_roles (user_id, role_id)
VALUES (
  'user-uuid-here',
  (SELECT id FROM public.roles 
   WHERE tenant_id = 'tenant-uuid' AND name = 'admin')
);
```

### Create a Persona with Full Identity Chain

```sql
-- 1. Create kybe_identity
INSERT INTO public.kybe_identity (kybe_did, state)
VALUES ('did:kybe:user123', 'active')
RETURNING *;

-- 2. Create root_identity
INSERT INTO public.root_identity (kybe_id, did_uri, kyc_status)
VALUES (
  (SELECT id FROM public.kybe_identity WHERE kybe_did = 'did:kybe:user123'),
  'did:root:user123',
  'unverified'
)
RETURNING *;

-- 3. Create persona
INSERT INTO public.persona (root_id, fio_handle, default_identity_state, world_id_status)
VALUES (
  (SELECT id FROM public.root_identity WHERE did_uri = 'did:root:user123'),
  'user123@fio',
  'semi_anonymous',
  'verified_human'
)
RETURNING *;
```

### Add CRM Contact

```sql
INSERT INTO crm.contacts (tenant_id, email, first_name, last_name, phone, created_by)
VALUES (
  'tenant-uuid',
  'contact@example.com',
  'John',
  'Doe',
  '+1234567890',
  auth.uid()
)
RETURNING *;
```

### Query Registry Instances with Templates

```sql
SELECT 
  i.instance_id,
  i.owner_id,
  i.metadata,
  t.name AS template_name,
  t.description AS template_description
FROM registry_mirror.instances i
JOIN registry_mirror.templates t ON i.template_id = t.id
WHERE i.owner_id = 'user-id-here'
ORDER BY i.created_at DESC
LIMIT 20;
```

### Check User Entitlements

```sql
SELECT 
  e.entitlement_type,
  i.instance_id,
  t.name AS template_name,
  e.granted_at,
  e.expires_at
FROM registry_mirror.entitlements e
JOIN registry_mirror.instances i ON e.instance_id = i.id
JOIN registry_mirror.templates t ON i.template_id = t.id
WHERE e.user_id = 'user-id-here'
  AND (e.expires_at IS NULL OR e.expires_at > now())
ORDER BY e.granted_at DESC;
```

### Verify Country Access

```sql
-- Check if a country is blocked for a tenant
SELECT 
  country_code,
  blocked,
  created_at
FROM compliance.country_blocks
WHERE tenant_id = 'tenant-uuid'
  AND country_code = 'US';

-- Block a country
INSERT INTO compliance.country_blocks (tenant_id, country_code, blocked)
VALUES ('tenant-uuid', 'CN', true)
ON CONFLICT (tenant_id, country_code) 
DO UPDATE SET blocked = EXCLUDED.blocked;
```

---

## 📊 Data Migration Reference

### Nakamoto Import Format

For importing user data from the Nakamoto system, use the `nakamoto_import` edge function with this structure:

```json
{
  "tenant_id": "tenant-uuid",
  "data": {
    "users": [
      {
        "source_user_id": "original-uuid",
        "email": "user@example.com",
        "tenant_id": "tenant-uuid",
        "status": "completed",
        "persona_type": "knyt",
        "invitation_status": { /* ... */ },
        "persona_data": { /* ... */ },
        "connection_data": [],
        "profile": { /* ... */ }
      }
    ],
    "interactions": [ /* ... */ ],
    "knowledge_base": [ /* ... */ ],
    "prompts": [ /* ... */ ]
  }
}
```

**Full specification**: See `NAKAMOTO_IMPORT_FORMAT.md`

---

## 🏗️ Schema Extension Guidelines

### Adding New Tables

1. **Choose the correct schema** based on purpose:
   - `public`: Core multi-tenant, identity, auth
   - `crm`: Customer/contact data
   - `registry_mirror`: Blockchain registry data
   - `black`: File/encryption data
   - `compliance`: KYC, geo-blocking, regulations
   - `billing`: Revenue, invoicing, metering
   - `ops`: Audit logs, analytics, monitoring

2. **Always enable RLS**:
```sql
ALTER TABLE schema_name.table_name ENABLE ROW LEVEL SECURITY;
```

3. **Create appropriate policies**:
```sql
-- Example: Tenant-scoped read policy
CREATE POLICY "tenant_read" ON schema_name.table_name
  FOR SELECT
  USING (tenant_id IN (
    SELECT ur.tenant_id 
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  ));
```

4. **Add foreign keys** for referential integrity:
```sql
ALTER TABLE child_table
  ADD CONSTRAINT fk_parent
  FOREIGN KEY (parent_id)
  REFERENCES parent_table(id)
  ON DELETE CASCADE;
```

5. **Create indexes** for performance:
```sql
CREATE INDEX idx_table_tenant ON schema_name.table_name(tenant_id);
CREATE INDEX idx_table_created ON schema_name.table_name(created_at DESC);
```

### Adding SECURITY DEFINER Functions

Always set `search_path` to prevent search path manipulation attacks:

```sql
CREATE OR REPLACE FUNCTION schema_name.function_name()
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = schema_name, public
AS $$
BEGIN
  -- Function body
END;
$$;
```

---

## 🧪 Testing and Verification

### Verify RLS is Working

```sql
-- Check RLS status for all tables
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname IN ('public', 'crm', 'registry_mirror', 'black', 'compliance')
ORDER BY schemaname, tablename;
```

### List All RLS Policies

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE schemaname IN ('public', 'crm', 'registry_mirror', 'black', 'compliance')
ORDER BY schemaname, tablename, policyname;
```

### Check Foreign Key Constraints

```sql
SELECT
  tc.table_schema, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('public', 'crm', 'registry_mirror', 'black', 'compliance')
ORDER BY tc.table_schema, tc.table_name;
```

---

## 🚀 SDK Integration

Three SDK packages are published for client integration:

### @qriptoagentiq/core-client
Core functionality: auth, IAM, upload, storage, sharing, metering

```typescript
import { initAgentiqClient } from "@qriptoagentiq/core-client";

const core = initAgentiqClient({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY
});

await core.ensureIamUser();
const tenants = await core.myTenants();
```

### @qriptoagentiq/kn0w1-client
Kn0w1-specific client for feed and post management

```typescript
import { Kn0w1Client } from "@qriptoagentiq/kn0w1-client";

const kn0w1 = new Kn0w1Client(core, {
  tenantId: "tenant-id",
  siteId: "site-id"
});

const feed = await kn0w1.feed(20);
```

### @qriptoagentiq/a2a-client
Agent-to-Agent communication (scaffold)

**Installation**:
```bash
npm i @qriptoagentiq/core-client@^0.1.9
npm i @supabase/supabase-js@^2.75.0
```

---

## 🔮 Phase 2 Roadmap

When implementing Phase 2 features, follow this order:

### 1. BlakQube Encryption (`blak` schema) - PRIORITY
- Complete `blak.payloads`, `blak.envelopes`, `blak.chunks`, `blak.derivatives` tables
- Implement envelope encryption with DEK wrapping
- Enable `upload_intake`, `issue_signed_url`, `generate_derivatives` functions
- Add `blak.share_payload()` and `blak.revoke_payload()` RPCs

### 2. Billing & Rev-Share (`billing` schema)
- Add `billing.accounts`, `billing.meters`, `billing.invoices`, `billing.line_items`
- Add `billing.revshare_rules`, `billing.revshare_splits`, `billing.attribution_models`
- Implement `billing.apply_revshare_for_invoice()` RPC

### 3. Compliance (`compliance` schema)
- Add `compliance.kyc_levels`, `compliance.kyc_attestations`
- Add `compliance.jurisdiction_policies`
- Implement full `compliance.can_download_payload()` with KYC checks

### 4. Operations & Analytics (`ops` schema)
- Add `ops.audit_log`, `ops.access_log`
- Add materialized views (e.g., `ops.mv_active_users_d`)
- Enable `analytics_refresh` function

---

## 📞 Support and Resources

- **Main README**: `/home/runner/work/QubeBase/QubeBase/README.md`
- **Nakamoto Import Spec**: `/home/runner/work/QubeBase/QubeBase/NAKAMOTO_IMPORT_FORMAT.md`
- **DiDQube Migration Guide**: `/home/runner/work/QubeBase/QubeBase/EXECUTE_DIDQUBE_MIGRATION.md`
- **SDK Documentation**: `/home/runner/work/QubeBase/QubeBase/packages/*/README.md`
- **Migrations**: `/home/runner/work/QubeBase/QubeBase/supabase/migrations/`
- **Edge Functions**: `/home/runner/work/QubeBase/QubeBase/supabase/functions/*/index.ts`

---

## ⚠️ Critical Security Notes

1. **Never disable RLS** on production tables
2. **Always use SECURITY DEFINER with fixed search_path** for privileged functions
3. **Validate all inputs** in edge functions using Zod or similar
4. **Use parameterized queries** to prevent SQL injection
5. **Implement rate limiting** on edge functions
6. **Sanitize error messages** to prevent information leakage
7. **Use constant-time comparison** for secrets (e.g., HMAC verification)
8. **Encrypt sensitive data** at rest and in transit
9. **Audit all UPDATE operations** on `user_roles` table
10. **Test RLS policies** thoroughly before deploying

---

## 📝 Example Workflow: Adding a New Feature

### Scenario: Add "Teams" feature to CRM

1. **Create migration file**:
```sql
-- supabase/migrations/20251028_add_crm_teams.sql

CREATE TABLE crm.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE crm.teams ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read policy
CREATE POLICY "teams_tenant_read" ON crm.teams
  FOR SELECT
  USING (tenant_id IN (
    SELECT DISTINCT r.tenant_id
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
  ));

-- Tenant admin can insert
CREATE POLICY "teams_tenant_admin_insert" ON crm.teams
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT r.tenant_id
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'super_admin', 'uber_admin')
    )
  );

-- Create indexes
CREATE INDEX idx_teams_tenant ON crm.teams(tenant_id);
CREATE INDEX idx_teams_created ON crm.teams(created_at DESC);
```

2. **Test in Supabase SQL Editor**
3. **Add to SDK if needed**
4. **Update documentation**
5. **Deploy via migration**

---

**End of Guide**

This document should be updated as the schema evolves. Last review: October 2025.
