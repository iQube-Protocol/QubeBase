# 📋 Paste This Summary to Another AI Model

## Context
You're about to work with the **QubeBase** repository - a production-grade Supabase backend for the Aigent Z ecosystem.

## What QubeBase Does
Multi-tenant database backend with:
- Multi-tenant isolation via RLS
- CRM (contacts, accounts)
- Blockchain registry mirroring
- DiDQube decentralized identity system
- SDK packages for TypeScript/JavaScript

## Where to Start

### 1. Quick Overview (Start Here)
Read: **SUPABASE_REPOSITORY_SUMMARY.md** (543 lines)
- What QubeBase is
- Database architecture overview
- Common SQL examples
- File structure
- Quick start checklist

### 2. For Database Work
Read: **SUPABASE_QUICK_REFERENCE.md** (235 lines)
- Fast lookup for common operations
- SQL snippets
- Security checks
- Common patterns

### 3. Deep Technical Reference
Read: **SUPABASE_DEVELOPER_GUIDE.md** (962 lines)
- Complete schema documentation
- All table definitions with columns
- RLS policies explained
- Edge functions documentation
- Security architecture
- Migration guidelines

## Database Summary

### Schemas (5 total)
```
public/           → Multi-tenant core + DiDQube identity (9 tables)
crm/              → Customer relationship management (2 tables)
registry_mirror/  → Blockchain registry data (4 tables)
black/            → File storage metadata (2 tables, partial)
compliance/       → Geo-blocking rules (1 table)
```

### Key Tables You'll Work With

**Multi-Tenant Core**:
- `public.tenants` - Organizations
- `public.sites` - Sub-organizations/apps
- `public.roles` - RBAC roles
- `public.user_roles` - User-role assignments

**DiDQube Identity**:
- `public.kybe_identity` - Root identity (World ID)
- `public.root_identity` - Persona root with DID
- `public.persona` - User personas with FIO handles
- `public.persona_agent_binding` - Persona-to-agent links
- `public.hcp_profile` - Human-Centric Profile

**CRM**:
- `crm.contacts` - Contact records
- `crm.accounts` - Account/org records

**Registry**:
- `registry_mirror.templates` - Template definitions
- `registry_mirror.instances` - Template instances
- `registry_mirror.proofs` - Blockchain proofs
- `registry_mirror.entitlements` - Access entitlements

## Security: 100% RLS Coverage

**Critical Rules**:
1. ✅ ALL tables have RLS enabled (46+ policies)
2. ✅ Tenant isolation enforced at DB level
3. ✅ SECURITY DEFINER functions use fixed search_path
4. ❌ NEVER disable RLS on production tables

## Supabase Project Info

- **Project ID**: `iqjjctrgwafkbpdotflw`
- **Dashboard**: https://app.supabase.com/project/iqjjctrgwafkbpdotflw
- **Location**: `/home/runner/work/QubeBase/QubeBase`

## Common SQL Patterns

### Create Tenant
```sql
INSERT INTO public.tenants (name)
VALUES ('New Company')
RETURNING *;
```

### Create DiDQube Identity
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
VALUES ('tenant-uuid', 'john@example.com', 'John', 'Doe')
RETURNING *;
```

### Query Registry
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

## Edge Functions

**Production Ready**:
- ✅ `registry_webhook` - Sync blockchain registry data
- ✅ `nakamoto_import` - Import user data

**Phase 2** (documented but not implemented):
- 📋 `upload_intake` - File uploads with caps
- 📋 `issue_signed_url` - Secure download URLs
- 📋 `generate_derivatives` - Thumbnails/previews
- 📋 `analytics_refresh` - Refresh materialized views

## SDK Packages

Published under `@qriptoagentiq/*`:
- **core-client** (v0.1.9) - Core functionality
- **kn0w1-client** (v0.1.9) - Kn0w1-specific
- **a2a-client** (v0.1.9) - Agent-to-Agent

```bash
npm i @qriptoagentiq/core-client@^0.1.9
npm i @supabase/supabase-js@^2.75.0
```

## File Locations

```
/home/runner/work/QubeBase/QubeBase/
├── SUPABASE_REPOSITORY_SUMMARY.md    ← Start here
├── SUPABASE_QUICK_REFERENCE.md       ← Fast lookup
├── SUPABASE_DEVELOPER_GUIDE.md       ← Deep reference
├── README.md                          ← Project overview
├── supabase/
│   ├── migrations/                    ← SQL migrations
│   └── functions/                     ← Edge functions
└── packages/                          ← SDK packages
    ├── core-client/
    ├── kn0w1-client/
    └── a2a-client/
```

## Your Next Steps

1. Read **SUPABASE_REPOSITORY_SUMMARY.md** for overview
2. Use **SUPABASE_QUICK_REFERENCE.md** for common tasks
3. Reference **SUPABASE_DEVELOPER_GUIDE.md** for details
4. Check `supabase/migrations/` for schema history
5. Review RLS policies before making changes

## What You Can Do

✅ Create new tables with proper RLS  
✅ Write SQL queries  
✅ Modify existing schemas  
✅ Add new RLS policies  
✅ Create SECURITY DEFINER functions  
✅ Add indexes and constraints  
✅ Implement Phase 2 features  

## What to Remember

1. **Always enable RLS** on new tables
2. **Always use tenant isolation** in queries
3. **Always validate inputs** in edge functions
4. **Always test policies** with different users
5. **Always use parameterized queries**

---

**You're ready to work with QubeBase in Supabase!** 🚀

Start with SUPABASE_REPOSITORY_SUMMARY.md and use the other docs as references.

Good luck!
