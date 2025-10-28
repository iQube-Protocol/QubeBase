# QubeBase - Supabase Quick Reference

**For**: AI models working in Supabase  
**Full Guide**: See `SUPABASE_DEVELOPER_GUIDE.md`

---

## 🎯 What is QubeBase?

Production Supabase backend for **Aigent Z ecosystem** with:
- Multi-tenant isolation (RLS)
- CRM (contacts, accounts)
- Registry mirroring (blockchain templates/instances)
- DiDQube identity system
- SDK packages for TypeScript/JS

**Supabase Project ID**: `iqjjctrgwafkbpdotflw`

---

## 📊 Schema Quick Map

| Schema | What It Does | Key Tables |
|--------|--------------|------------|
| `public` | Multi-tenant core + identity | tenants, sites, roles, user_roles, persona, kybe_identity |
| `crm` | Customer data | contacts, accounts |
| `registry_mirror` | Blockchain data | templates, instances, proofs, entitlements |
| `black` | File storage (partial) | payloads, payload_grants |
| `compliance` | Geo-blocking | country_blocks |

---

## 🔐 Security Essentials

### RLS is ALWAYS Enabled
- ✅ 100% table coverage
- ✅ 46+ policies
- ✅ Tenant isolation enforced

### Key Security Functions
```sql
-- Check if user has role
SELECT public.has_role('user-uuid', 'admin');

-- Check download authorization
SELECT compliance.can_download_payload(
  'payload-uuid',
  'user-uuid', 
  'US'
);
```

---

## 💡 Common Operations

### Create Tenant
```sql
INSERT INTO public.tenants (name)
VALUES ('New Tenant')
RETURNING *;
```

### Create Persona (DiDQube)
```sql
-- 1. Kybe identity
INSERT INTO public.kybe_identity (kybe_did, state)
VALUES ('did:kybe:user123', 'active')
RETURNING *;

-- 2. Root identity
INSERT INTO public.root_identity (kybe_id, did_uri)
VALUES (
  (SELECT id FROM kybe_identity WHERE kybe_did = 'did:kybe:user123'),
  'did:root:user123'
)
RETURNING *;

-- 3. Persona
INSERT INTO public.persona (root_id, fio_handle, default_identity_state)
VALUES (
  (SELECT id FROM root_identity WHERE did_uri = 'did:root:user123'),
  'user@fio',
  'semi_anonymous'
)
RETURNING *;
```

### Add CRM Contact
```sql
INSERT INTO crm.contacts (tenant_id, email, first_name, last_name)
VALUES ('tenant-uuid', 'contact@example.com', 'John', 'Doe')
RETURNING *;
```

### Query Registry Data
```sql
SELECT 
  i.instance_id,
  t.name AS template_name,
  i.metadata
FROM registry_mirror.instances i
JOIN registry_mirror.templates t ON i.template_id = t.id
WHERE i.owner_id = 'user-id'
LIMIT 20;
```

---

## 🔧 Edge Functions Status

| Function | Status | Purpose |
|----------|--------|---------|
| `registry_webhook` | ✅ Production | Sync blockchain registry data |
| `nakamoto_import` | ✅ Production | Import Nakamoto user data |
| `upload_intake` | 📋 Phase 2 | File uploads with caps |
| `issue_signed_url` | 📋 Phase 2 | Secure download URLs |
| `generate_derivatives` | 📋 Phase 2 | Thumbnails/previews |
| `analytics_refresh` | 📋 Phase 2 | Refresh materialized views |

---

## 📦 SDK Packages

```bash
# Install
npm i @qriptoagentiq/core-client@^0.1.9
npm i @qriptoagentiq/kn0w1-client@^0.1.9
npm i @supabase/supabase-js@^2.75.0
```

```typescript
import { initAgentiqClient } from "@qriptoagentiq/core-client";

const core = initAgentiqClient({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY
});

await core.ensureIamUser();
const tenants = await core.myTenants();
```

---

## 🧪 Quick Checks

### Verify RLS
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname IN ('public', 'crm', 'registry_mirror')
ORDER BY schemaname, tablename;
```

### List Policies
```sql
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Check Tables
```sql
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname IN ('public', 'crm', 'registry_mirror', 'black', 'compliance')
ORDER BY schemaname, tablename;
```

---

## ⚠️ Critical Rules

1. ❌ **NEVER disable RLS** on production tables
2. ✅ **ALWAYS use SECURITY DEFINER with fixed search_path**
3. ✅ **ALWAYS validate inputs** in edge functions
4. ✅ **ALWAYS use parameterized queries**
5. ✅ **ALWAYS test RLS policies** before deploying

---

## 🚀 Adding New Tables

```sql
-- 1. Create table
CREATE TABLE schema_name.new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE schema_name.new_table ENABLE ROW LEVEL SECURITY;

-- 3. Add policies
CREATE POLICY "tenant_read" ON schema_name.new_table
  FOR SELECT
  USING (tenant_id IN (
    SELECT DISTINCT r.tenant_id
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
  ));

-- 4. Create indexes
CREATE INDEX idx_new_table_tenant ON schema_name.new_table(tenant_id);
```

---

## 📚 Key Files Reference

- **Full Guide**: `SUPABASE_DEVELOPER_GUIDE.md` (962 lines)
- **Nakamoto Import**: `NAKAMOTO_IMPORT_FORMAT.md`
- **DiDQube Migration**: `EXECUTE_DIDQUBE_MIGRATION.md`
- **Main README**: `README.md`
- **Migrations**: `supabase/migrations/*.sql`
- **Edge Functions**: `supabase/functions/*/index.ts`

---

## 🔮 Phase 2 Priorities

1. **BlakQube Encryption** - Complete `blak.*` schema
2. **Billing & Rev-Share** - Add `billing.*` schema
3. **Advanced Compliance** - Expand `compliance.*` schema
4. **Operations** - Add `ops.*` schema for audit/analytics

---

**Last Updated**: October 2025  
**For detailed information, consult**: `SUPABASE_DEVELOPER_GUIDE.md`
