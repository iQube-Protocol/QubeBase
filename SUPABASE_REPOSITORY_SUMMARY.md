# QubeBase Repository Summary for AI Models

**Created**: October 28, 2025  
**Purpose**: Comprehensive summary for AI models to understand and work with QubeBase in Supabase

---

## 📖 What You Need to Know

This repository contains **QubeBase**, a production-grade Supabase backend that powers the **Aigent Z ecosystem**. If you're an AI model working directly in Supabase, this summary provides everything you need to understand the system and make changes confidently.

---

## 🎯 Quick Start: What is QubeBase?

QubeBase is a **multi-tenant database backend** built on Supabase (PostgreSQL + Auth + Storage + Edge Functions) that provides:

1. **Multi-tenant isolation** - Organizations are completely separated via Row-Level Security (RLS)
2. **CRM functionality** - Contacts and accounts with tenant-scoped access
3. **Registry mirroring** - Syncs blockchain registry data (templates, instances, proofs, entitlements)
4. **DiDQube identity** - Decentralized identity system with personas, FIO handles, and World ID verification
5. **SDK packages** - Three published npm packages for TypeScript/JavaScript integration
6. **Edge functions** - Serverless functions for webhooks, imports, and file processing

### Apps Using QubeBase
- **Nakamoto**: Bitcoin-focused tools and services
- **Kn0w1**: Knowledge management and media feeds
- **Moneypenny**: Administrative and operational tools
- **AgentIQ**: Agentic AI orchestration

---

## 📚 Documentation Structure

The repository includes several comprehensive guides. Here's what to read based on your needs:

### For Database Work in Supabase (YOU ARE HERE)
1. **SUPABASE_QUICK_REFERENCE.md** - Fast lookup (235 lines)
   - Common SQL operations
   - Schema overview
   - Security checks
   - Quick examples

2. **SUPABASE_DEVELOPER_GUIDE.md** - Complete reference (962 lines)
   - Full schema documentation
   - All table definitions with columns
   - RLS policies explained
   - Edge functions documentation
   - Security architecture
   - Migration guidelines

### For Application Development
3. **README.md** - Project overview
   - Architecture overview
   - SDK installation
   - Release process
   - Quick start guide

4. **NAKAMOTO_IMPORT_FORMAT.md** - Data import specification
   - JSON format for user imports
   - Interaction history format
   - Knowledge base format

5. **EXECUTE_DIDQUBE_MIGRATION.md** - DiDQube migration guide
   - Step-by-step migration instructions
   - Verification steps

---

## 🗄️ Database Architecture at a Glance

### Schemas and Their Purpose

```
public/           ← Multi-tenant core + DiDQube identity
  ├── tenants            # Organizations
  ├── sites              # Sub-organizations/apps
  ├── roles              # RBAC roles per tenant
  ├── user_roles         # User-role assignments
  ├── kybe_identity      # Root identity (World ID)
  ├── root_identity      # Persona root with DID
  ├── persona            # User personas with FIO handles
  ├── persona_agent_binding  # Persona-to-agent links
  └── hcp_profile        # Human-Centric Profile data

crm/              ← Customer relationship management
  ├── contacts           # Contact records (tenant-scoped)
  └── accounts           # Account/org records

registry_mirror/  ← Blockchain registry data
  ├── templates          # Template definitions from DVN/ICP
  ├── instances          # Template instances
  ├── proofs             # Blockchain proofs
  └── entitlements       # Access entitlements

black/            ← File storage (Phase 2 - partial)
  ├── payloads           # File metadata
  └── payload_grants     # Access grants

compliance/       ← Geo-blocking and compliance
  └── country_blocks     # Country-level access rules
```

### Key Relationships

```
tenants (1) ──→ (N) sites
tenants (1) ──→ (N) roles
roles (1) ──→ (N) user_roles (N) ──→ (1) auth.users

kybe_identity (1) ──→ (N) root_identity
root_identity (1) ──→ (N) persona
persona (1) ──→ (N) persona_agent_binding
persona (1) ──→ (1) hcp_profile

templates (1) ──→ (N) instances
instances (1) ──→ (N) proofs
instances (1) ──→ (N) entitlements

payloads (1) ──→ (N) payload_grants
```

---

## 🔐 Security Architecture

### Row-Level Security (RLS)
- **100% coverage**: All 14+ tables have RLS enabled
- **46+ policies**: Granular access control
- **Tenant isolation**: Users only see data from their tenants
- **Role-based access**: Admin/user separation enforced at DB level

### Key Security Patterns

```sql
-- Tenant-scoped read (most common pattern)
CREATE POLICY "tenant_read" ON schema.table
  FOR SELECT
  USING (tenant_id IN (
    SELECT DISTINCT r.tenant_id
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
  ));

-- Admin-only write
CREATE POLICY "admin_write" ON schema.table
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'super_admin')
        AND r.tenant_id = schema.table.tenant_id
    )
  );
```

### SECURITY DEFINER Functions
Always set `search_path` to prevent attacks:

```sql
CREATE OR REPLACE FUNCTION schema.function_name()
RETURNS return_type
LANGUAGE sql
SECURITY DEFINER
SET search_path = schema, public  -- Critical!
AS $$ ... $$;
```

---

## 🔧 Edge Functions

| Function | Status | Purpose | Location |
|----------|--------|---------|----------|
| `registry_webhook` | ✅ Production | Sync blockchain registry (DVN/ICP) | `/supabase/functions/registry_webhook/` |
| `nakamoto_import` | ✅ Production | Import Nakamoto user data | `/supabase/functions/nakamoto_import/` |
| `upload_intake` | 📋 Phase 2 | File uploads with caps | `/supabase/functions/upload_intake/` |
| `issue_signed_url` | 📋 Phase 2 | Secure download URLs | `/supabase/functions/issue_signed_url/` |
| `generate_derivatives` | 📋 Phase 2 | Thumbnails/previews | `/supabase/functions/generate_derivatives/` |
| `ipfs_icp_connector` | 📋 Phase 2 | IPFS/ICP replication | `/supabase/functions/ipfs_icp_connector/` |
| `analytics_refresh` | 📋 Phase 2 | Refresh materialized views | `/supabase/functions/analytics_refresh/` |

### Registry Webhook (Production Ready)
Receives webhook events from external blockchain registry:

**Event Types**:
- `template.upsert` - Create/update template
- `instance.upsert` - Create/update instance
- `proof.append` - Add blockchain proof
- `entitlement.grant` - Grant access entitlement

**Security**:
- HMAC signature verification
- Replay attack prevention (5-min window)
- Zod input validation

---

## 📦 SDK Packages

Three packages published under `@qriptoagentiq/*`:

### @qriptoagentiq/core-client (v0.1.9)
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

### @qriptoagentiq/kn0w1-client (v0.1.9)
Kn0w1-specific client for feed and post management

### @qriptoagentiq/a2a-client (v0.1.9)
Agent-to-Agent communication (scaffold)

**Installation**:
```bash
npm i @qriptoagentiq/core-client@^0.1.9 @qriptoagentiq/kn0w1-client@^0.1.9
npm i @supabase/supabase-js@^2.75.0
```

---

## 💡 Common Use Cases & SQL Examples

### 1. Create a New Tenant

```sql
-- Insert tenant
INSERT INTO public.tenants (name)
VALUES ('Acme Corporation')
RETURNING *;

-- Create default roles
INSERT INTO public.roles (tenant_id, name)
SELECT 
  (SELECT id FROM public.tenants WHERE name = 'Acme Corporation'),
  unnest(ARRAY['user', 'admin', 'super_admin']);
```

### 2. Create DiDQube Identity (Full Chain)

```sql
-- Step 1: Kybe identity
INSERT INTO public.kybe_identity (kybe_did, state)
VALUES ('did:kybe:alice123', 'active')
RETURNING *;

-- Step 2: Root identity
INSERT INTO public.root_identity (kybe_id, did_uri, kyc_status)
VALUES (
  (SELECT id FROM public.kybe_identity WHERE kybe_did = 'did:kybe:alice123'),
  'did:root:alice123',
  'unverified'
)
RETURNING *;

-- Step 3: Persona
INSERT INTO public.persona (root_id, fio_handle, default_identity_state, world_id_status)
VALUES (
  (SELECT id FROM public.root_identity WHERE did_uri = 'did:root:alice123'),
  'alice@fio',
  'semi_anonymous',
  'verified_human'
)
RETURNING *;

-- Step 4 (Optional): HCP Profile
INSERT INTO public.hcp_profile (persona_id, scopes, preference_ptr)
VALUES (
  (SELECT id FROM public.persona WHERE fio_handle = 'alice@fio'),
  '{"read": true, "write": true}'::jsonb,
  'https://preferences.example.com/alice'
);
```

### 3. Add CRM Contact

```sql
INSERT INTO crm.contacts (tenant_id, email, first_name, last_name, phone, created_by)
VALUES (
  'tenant-uuid-here',
  'john@example.com',
  'John',
  'Doe',
  '+1234567890',
  auth.uid()
)
RETURNING *;
```

### 4. Query Registry with Templates

```sql
SELECT 
  i.instance_id,
  i.owner_id,
  i.metadata,
  t.name AS template_name,
  t.description AS template_description,
  COUNT(p.id) AS proof_count
FROM registry_mirror.instances i
JOIN registry_mirror.templates t ON i.template_id = t.id
LEFT JOIN registry_mirror.proofs p ON p.instance_id = i.id
WHERE i.owner_id = 'user-id-here'
GROUP BY i.id, t.id
ORDER BY i.created_at DESC
LIMIT 20;
```

### 5. Check User Permissions

```sql
-- Check if user has admin role in any tenant
SELECT 
  t.name AS tenant_name,
  r.name AS role_name,
  ur.assigned_at
FROM public.user_roles ur
JOIN public.roles r ON ur.role_id = r.id
JOIN public.tenants t ON r.tenant_id = t.id
WHERE ur.user_id = auth.uid()
  AND r.name IN ('admin', 'super_admin', 'uber_admin');
```

### 6. Block/Unblock Countries

```sql
-- Block a country for a tenant
INSERT INTO compliance.country_blocks (tenant_id, country_code, blocked)
VALUES ('tenant-uuid', 'CN', true)
ON CONFLICT (tenant_id, country_code) 
DO UPDATE SET blocked = EXCLUDED.blocked;

-- Check blocked countries
SELECT country_code, blocked, created_at
FROM compliance.country_blocks
WHERE tenant_id = 'tenant-uuid'
  AND blocked = true;
```

---

## 🧪 Verification Queries

### Check RLS Status
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname IN ('public', 'crm', 'registry_mirror', 'black', 'compliance')
ORDER BY schemaname, tablename;
```

### List All Policies
```sql
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname IN ('public', 'crm', 'registry_mirror')
ORDER BY schemaname, tablename, policyname;
```

### Check Foreign Keys
```sql
SELECT
  tc.table_schema, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('public', 'crm', 'registry_mirror')
ORDER BY tc.table_schema, tc.table_name;
```

---

## 🚀 Phase 2 Roadmap

Features documented but not yet implemented:

### 1. BlakQube Encryption (Priority 1)
- Complete `blak.*` schema (payloads, envelopes, chunks, derivatives)
- Envelope encryption with DEK wrapping
- Client-side encryption support
- Enable upload_intake, issue_signed_url, generate_derivatives functions

### 2. Billing & Rev-Share
- Add `billing.*` schema (accounts, meters, invoices, line_items)
- Revenue sharing rules and splits
- Metering and invoice generation

### 3. Advanced Compliance
- Expand `compliance.*` schema (KYC attestations, jurisdiction policies)
- PII masking functions
- Advanced access controls

### 4. Operations & Analytics
- Add `ops.*` schema (audit_log, access_log)
- Materialized views for analytics
- Real-time monitoring

### 5. DID/FIO Integration
- Add `did.*` and `fio.*` schemas
- Decentralized identity management
- FIO protocol integration

### 6. A2A/MCP Agentic
- Add `agentic.*` schema (tools, agents, grants, invocations)
- Agent catalog and quota tracking

---

## ⚠️ Critical Rules for AI Models

When working in Supabase:

1. ❌ **NEVER disable RLS** on any table
2. ✅ **ALWAYS enable RLS** on new tables
3. ✅ **ALWAYS use SECURITY DEFINER with SET search_path** for privileged functions
4. ✅ **ALWAYS validate inputs** in edge functions (use Zod)
5. ✅ **ALWAYS use parameterized queries** (Supabase client does this automatically)
6. ✅ **ALWAYS test RLS policies** with different user roles before deploying
7. ✅ **ALWAYS add indexes** on foreign keys and commonly queried columns
8. ✅ **ALWAYS use ON DELETE CASCADE/SET NULL** appropriately on foreign keys
9. ❌ **NEVER expose sensitive data** in error messages
10. ✅ **ALWAYS sanitize error messages** in edge functions

---

## 📁 File Structure Reference

```
/home/runner/work/QubeBase/QubeBase/
├── README.md                          # Main project README
├── SUPABASE_DEVELOPER_GUIDE.md        # Complete DB reference (962 lines)
├── SUPABASE_QUICK_REFERENCE.md        # Quick lookup (235 lines)
├── SUPABASE_REPOSITORY_SUMMARY.md     # This file
├── NAKAMOTO_IMPORT_FORMAT.md          # Data import spec
├── EXECUTE_DIDQUBE_MIGRATION.md       # DiDQube migration guide
├── MIGRATION_SUCCESS.md               # DiDQube migration results
├── package.json                       # Root package.json
├── supabase/
│   ├── config.toml                    # Supabase config (project_id)
│   ├── migrations/                    # SQL migrations
│   │   ├── 20251011193223_*.sql      # Initial schema
│   │   ├── 20251015_didqube.sql      # DiDQube identity
│   │   └── ...                        # Other migrations
│   └── functions/                     # Edge functions
│       ├── registry_webhook/          # Blockchain webhook (✅)
│       ├── nakamoto_import/           # User import (✅)
│       ├── upload_intake/             # File upload (📋 Phase 2)
│       ├── issue_signed_url/          # Signed URLs (📋 Phase 2)
│       ├── generate_derivatives/      # Derivatives (📋 Phase 2)
│       ├── ipfs_icp_connector/        # Hybrid storage (📋 Phase 2)
│       └── analytics_refresh/         # Analytics (📋 Phase 2)
├── packages/                          # SDK packages
│   ├── core-client/                   # @qriptoagentiq/core-client
│   ├── kn0w1-client/                  # @qriptoagentiq/kn0w1-client
│   └── a2a-client/                    # @qriptoagentiq/a2a-client
├── releases/                          # Pre-built SDK tarballs
├── src/                               # Frontend app (React + Vite)
│   ├── pages/                         # App pages
│   ├── components/                    # React components
│   └── lib/                           # Utilities
└── seed/                              # Test data
    └── seed.sql                       # Seed data for testing
```

---

## 🔗 Supabase Project Details

**Project ID**: `iqjjctrgwafkbpdotflw`  
**Dashboard**: https://app.supabase.com/project/iqjjctrgwafkbpdotflw  
**Database**: PostgreSQL 15+  
**Auth**: Supabase Auth with JWT  
**Storage**: Supabase Storage (buckets not fully configured yet)

### Environment Variables

```bash
SUPABASE_URL=https://iqjjctrgwafkbpdotflw.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# File size caps
APP_FILE_SOFT_CAP_BYTES=524288000      # 500 MB
APP_FILE_HARD_CAP_BYTES=1073741824     # 1 GB
```

---

## 📞 Getting Help

1. **Start here**: `SUPABASE_QUICK_REFERENCE.md` for common tasks
2. **Deep dive**: `SUPABASE_DEVELOPER_GUIDE.md` for complete details
3. **Check migrations**: `supabase/migrations/` for schema history
4. **Review edge functions**: `supabase/functions/*/index.ts` for business logic

---

## ✅ Summary Checklist

When you need to work in Supabase, you now know:

- [x] What QubeBase is and its purpose
- [x] Database schema structure (5 schemas, 14+ tables)
- [x] Security architecture (RLS policies, SECURITY DEFINER functions)
- [x] Common SQL operations (tenants, personas, CRM, registry)
- [x] Edge functions and their status
- [x] SDK packages and integration
- [x] Verification queries for testing
- [x] Phase 2 roadmap for future features
- [x] Critical security rules to follow
- [x] Where to find detailed documentation

---

**You're ready to work confidently in Supabase!**

For any specific task, refer to the appropriate documentation file listed above. Good luck! 🚀

---

**Last Updated**: October 28, 2025  
**Maintained by**: iQube Protocol Team  
**Repository**: https://github.com/iQube-Protocol/QubeBase
