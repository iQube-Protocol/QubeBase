# Execute DiDQube Migration - Manual Steps

**Migration File**: `supabase/migrations/20251015_didqube.sql`  
**Status**: ✅ Committed to QubeBase repo (commit `890489a`)  
**Date**: October 15, 2025

---

## 🎯 Quick Summary

This migration creates 5 new tables for the DiDQube identity and reputation system:
1. `kybe_identity` - Root identity with World ID integration
2. `root_identity` - Persona root identities
3. `persona` - User personas with FIO handles
4. `persona_agent_binding` - Links personas to agents
5. `hcp_profile` - Human-Centric Profile data

---

## 📋 Execution Steps

### **Step 1: Access Supabase Dashboard**

1. Go to: https://app.supabase.com
2. Select project: **QubeBase** (project ref: `iqjjctrgwafkbpdotflw`)
3. Navigate to **SQL Editor** in left sidebar

### **Step 2: Create New Query**

1. Click **New Query** button
2. Name it: `DiDQube Migration - Phase 1`

### **Step 3: Copy Migration SQL**

Copy the entire contents of:
```
/Users/hal1/CascadeProjects/QubeBase/supabase/migrations/20251015_didqube.sql
```

Or copy from below:

```sql
-- DiDQube: Additive Supabase migration (Phase 1)
-- Run in Supabase SQL editor. Non-breaking, additive only.

create extension if not exists pgcrypto;

create table if not exists public.kybe_identity (
  id uuid primary key default gen_random_uuid(),
  kybe_did text unique not null,
  encrypted_soul_key text,
  state text check (state in ('active','revoked','deceased')) default 'active',
  issued_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.root_identity (
  id uuid primary key default gen_random_uuid(),
  kybe_id uuid references public.kybe_identity(id) on delete set null,
  kybe_hash text,
  did_uri text unique not null,
  kyc_status text check (kyc_status in ('unverified','kycd','revoked')) default 'unverified',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.persona (
  id uuid primary key default gen_random_uuid(),
  root_id uuid references public.root_identity(id) on delete set null,
  fio_handle text,
  default_identity_state text check (default_identity_state in ('anonymous','semi_anonymous','semi_identifiable','identifiable')) not null default 'semi_anonymous',
  app_origin text,
  world_id_status text check (world_id_status in ('unverified','verified_human','agent_declared')) default 'unverified',
  created_at timestamptz default now()
);

create table if not exists public.persona_agent_binding (
  persona_id uuid references public.persona(id) on delete cascade,
  agent_id text not null,
  is_primary boolean default false,
  created_at timestamptz default now(),
  primary key (persona_id, agent_id)
);

create table if not exists public.hcp_profile (
  persona_id uuid primary key references public.persona(id) on delete cascade,
  preference_ptr text,
  scopes jsonb,
  revocation jsonb,
  updated_at timestamptz default now()
);

-- RLS enablement (adjust policies later as needed)
alter table public.kybe_identity enable row level security;
alter table public.root_identity enable row level security;
alter table public.persona enable row level security;
alter table public.persona_agent_binding enable row level security;
alter table public.hcp_profile enable row level security;

-- Basic permissive policies (tighten in later sprints)
create policy if not exists "persona read own or public app" on public.persona
  for select using (true);
create policy if not exists "persona insert by authenticated" on public.persona
  for insert with check (auth.role() = 'authenticated');

create policy if not exists "bindings read" on public.persona_agent_binding
  for select using (true);
create policy if not exists "bindings write by authenticated" on public.persona_agent_binding
  for insert with check (auth.role() = 'authenticated');
```

### **Step 4: Execute Migration**

1. Paste the SQL into the editor
2. Click **Run** button (or press `Cmd+Enter`)
3. Wait for execution to complete
4. Check for success message in output panel

---

## ✅ Verification Steps

After running the migration, verify tables were created:

### **Check Tables Exist**

Run this query:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'kybe_identity',
  'root_identity', 
  'persona',
  'persona_agent_binding',
  'hcp_profile'
);
```

**Expected**: 5 rows returned

### **Check RLS is Enabled**

Run this query:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'kybe_identity',
  'root_identity',
  'persona', 
  'persona_agent_binding',
  'hcp_profile'
);
```

**Expected**: All tables should have `rowsecurity = true`

### **Check Policies Exist**

Run this query:
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN (
  'kybe_identity',
  'root_identity',
  'persona',
  'persona_agent_binding', 
  'hcp_profile'
);
```

**Expected**: At least 4 policies (2 for persona, 2 for persona_agent_binding)

---

## 🧪 Create Test Data

After verification, create a test persona:

```sql
-- Insert test kybe_identity
INSERT INTO kybe_identity (kybe_did)
VALUES ('did:kybe:test123')
RETURNING *;

-- Insert test root_identity (use the kybe_identity id from above)
INSERT INTO root_identity (kybe_id, did_uri)
VALUES (
  (SELECT id FROM kybe_identity WHERE kybe_did = 'did:kybe:test123'),
  'did:root:test123'
)
RETURNING *;

-- Insert test persona (use the root_identity id from above)
INSERT INTO persona (root_id, fio_handle, default_identity_state, world_id_status)
VALUES (
  (SELECT id FROM root_identity WHERE did_uri = 'did:root:test123'),
  'test@fio',
  'semi_anonymous',
  'verified_human'
)
RETURNING *;

-- Verify test persona
SELECT * FROM persona WHERE fio_handle = 'test@fio';
```

---

## 🔗 Test AigentZBeta Integration

After creating test data, test the API:

```bash
# List personas (should return test persona)
curl https://dev.d2jszlp3ckm8gp.amplifyapp.com/api/identity/persona

# Or test locally
curl http://localhost:3000/api/identity/persona
```

---

## 🚨 Troubleshooting

### **Error: "relation already exists"**

**Cause**: Tables already exist from a previous run.

**Solution**: Migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to re-run. If you need to start fresh:

```sql
-- Drop tables in reverse dependency order (CAUTION: deletes all data)
DROP TABLE IF EXISTS hcp_profile CASCADE;
DROP TABLE IF EXISTS persona_agent_binding CASCADE;
DROP TABLE IF EXISTS persona CASCADE;
DROP TABLE IF EXISTS root_identity CASCADE;
DROP TABLE IF EXISTS kybe_identity CASCADE;

-- Then re-run the migration
```

### **Error: "permission denied"**

**Cause**: Not using admin/service role.

**Solution**: Make sure you're logged into Supabase dashboard with proper permissions.

### **Error: "auth.role() does not exist"**

**Cause**: RLS policies reference auth functions that may not be available.

**Solution**: Policies are permissive for Phase 1. If errors occur, you can temporarily disable RLS:

```sql
-- Only for debugging (NOT for production)
ALTER TABLE persona DISABLE ROW LEVEL SECURITY;
```

---

## 📊 Expected Results

After successful migration:

- ✅ 5 new tables created
- ✅ RLS enabled on all tables
- ✅ 4 policies created (2 for persona, 2 for persona_agent_binding)
- ✅ Test persona can be created
- ✅ AigentZBeta API can query personas

---

## 🔄 Next Steps

After migration is complete:

1. ✅ Verify tables in Supabase dashboard
2. ✅ Create test persona
3. ✅ Test AigentZBeta API integration
4. ⏭️ Push QubeBase commit to GitHub
5. ⏭️ Update AigentZBeta environment variables (if needed)
6. ⏭️ Test Ops Console DiDQube cards
7. ⏭️ Test Registry identity filters

---

## 📚 Related Documentation

- **Migration File**: `supabase/migrations/20251015_didqube.sql`
- **AigentZBeta Guide**: `../AigentZBeta/docs/QUBEBASE_MIGRATION_GUIDE.md`
- **Phase 1 Summary**: `../AigentZBeta/docs/DIDQUBE_PHASE1_SUMMARY.md`

---

**Project**: QubeBase  
**Migration**: DiDQube Phase 1  
**Status**: Ready to execute  
**Commit**: `890489a`
