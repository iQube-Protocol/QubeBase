-- Migration: Add / sync RLS policies and supporting indexes for multiple tables
-- Generated from user-provided policy SQL (2025-12-02)
-- Run as superuser or via the Supabase service_role key.
BEGIN;

SET LOCAL search_path = public;

-- ------------------------
-- custody_events
-- ------------------------
ALTER TABLE IF EXISTS public.custody_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custody_events_select_by_jwt_did ON public.custody_events;
CREATE POLICY custody_events_select_by_jwt_did
  ON public.custody_events
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'did') IS NOT NULL
    AND (
      (auth.jwt() ->> 'did') = from_did
      OR (auth.jwt() ->> 'did') = to_did
    )
  );

DROP POLICY IF EXISTS custody_events_insert_by_jwt_did ON public.custody_events;
CREATE POLICY custody_events_insert_by_jwt_did
  ON public.custody_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'did') IS NOT NULL
    AND (auth.jwt() ->> 'did') = from_did
  );

DROP POLICY IF EXISTS custody_events_update_by_jwt_did ON public.custody_events;
CREATE POLICY custody_events_update_by_jwt_did
  ON public.custody_events
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'did') IS NOT NULL
    AND (
      (auth.jwt() ->> 'did') = from_did
      OR (auth.jwt() ->> 'did') = to_did
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'did') IS NOT NULL
    AND (
      (auth.jwt() ->> 'did') = from_did
      OR (auth.jwt() ->> 'did') = to_did
    )
  );

DROP POLICY IF EXISTS custody_events_delete_by_jwt_did ON public.custody_events;
CREATE POLICY custody_events_delete_by_jwt_did
  ON public.custody_events
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'did') IS NOT NULL
    AND (auth.jwt() ->> 'did') = from_did
  );

CREATE INDEX IF NOT EXISTS custody_events_from_did_idx ON public.custody_events(from_did);

-- ------------------------
-- tenant_api_keys
-- ------------------------
ALTER TABLE IF EXISTS public.tenant_api_keys ENABLE ROW LEVEL SECURITY;

-- Revoke all table-level privileges from authenticated (defensive)
-- Note: REVOKE will fail if privileges are not present; use DO block to ignore errors if desired.
REVOKE ALL ON public.tenant_api_keys FROM authenticated;

DROP POLICY IF EXISTS tenant_api_keys_select ON public.tenant_api_keys;
CREATE POLICY tenant_api_keys_select ON public.tenant_api_keys
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ------------------------
-- quotes
-- ------------------------
ALTER TABLE IF EXISTS public.quotes ENABLE ROW LEVEL SECURITY;

-- Drop well-known policy names if present
DROP POLICY IF EXISTS quotes_select ON public.quotes;
DROP POLICY IF EXISTS quotes_select_tenant ON public.quotes;
DROP POLICY IF EXISTS quotes_select_public ON public.quotes;
DROP POLICY IF EXISTS quotes_insert ON public.quotes;
DROP POLICY IF EXISTS quotes_insert_tenant ON public.quotes;
DROP POLICY IF EXISTS quotes_update ON public.quotes;
DROP POLICY IF EXISTS quotes_delete ON public.quotes;
DROP POLICY IF EXISTS quotes_full_access ON public.quotes;

-- Drop any remaining policies on public.quotes (dynamic)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.quotes'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.quotes;', r.polname);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_quotes_tenant_id ON public.quotes (tenant_id);

DROP POLICY IF EXISTS quotes_select ON public.quotes;
CREATE POLICY quotes_select ON public.quotes
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS quotes_insert ON public.quotes;
CREATE POLICY quotes_insert ON public.quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS quotes_update ON public.quotes;
CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE
  TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS quotes_delete ON public.quotes;
CREATE POLICY quotes_delete ON public.quotes
  FOR DELETE
  TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Grant table privileges to authenticated so RLS can be enforced (optional)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;

-- ------------------------
-- dvn_attestations
-- ------------------------
ALTER TABLE IF EXISTS public.dvn_attestations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dvn_attestations_tenant_id ON public.dvn_attestations (tenant_id);

DROP POLICY IF EXISTS dvn_attestations_select ON public.dvn_attestations;
DROP POLICY IF EXISTS dvn_attestations_insert ON public.dvn_attestations;
DROP POLICY IF EXISTS dvn_attestations_update ON public.dvn_attestations;
DROP POLICY IF EXISTS dvn_attestations_delete ON public.dvn_attestations;

CREATE POLICY dvn_attestations_select ON public.dvn_attestations
  FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Add user_id column if not present (safe)
ALTER TABLE IF EXISTS public.dvn_attestations
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_dvn_attestations_user_id ON public.dvn_attestations (user_id);

-- Replace policies with user-scoped ones
DROP POLICY IF EXISTS dvn_attestations_select ON public.dvn_attestations;
DROP POLICY IF EXISTS dvn_attestations_insert ON public.dvn_attestations;
DROP POLICY IF EXISTS dvn_attestations_update ON public.dvn_attestations;
DROP POLICY IF EXISTS dvn_attestations_delete ON public.dvn_attestations;

CREATE POLICY dvn_attestations_select ON public.dvn_attestations
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY dvn_attestations_insert ON public.dvn_attestations
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY dvn_attestations_update ON public.dvn_attestations
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY dvn_attestations_delete ON public.dvn_attestations
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dvn_attestations TO authenticated;

-- ------------------------
-- deliveries
-- ------------------------
ALTER TABLE IF EXISTS public.deliveries ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.deliveries ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_deliveries_user_id ON public.deliveries (user_id);

DROP POLICY IF EXISTS deliveries_select ON public.deliveries;
DROP POLICY IF EXISTS deliveries_insert ON public.deliveries;
DROP POLICY IF EXISTS deliveries_update ON public.deliveries;
DROP POLICY IF EXISTS deliveries_delete ON public.deliveries;

CREATE POLICY deliveries_select ON public.deliveries
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY deliveries_insert ON public.deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY deliveries_update ON public.deliveries
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY deliveries_delete ON public.deliveries
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;

-- ------------------------
-- iqube_events
-- ------------------------
ALTER TABLE IF EXISTS public.iqube_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.iqube_events
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_iqube_events_user_id ON public.iqube_events (user_id);

DROP POLICY IF EXISTS iqube_events_select ON public.iqube_events;
DROP POLICY IF EXISTS iqube_events_insert ON public.iqube_events;
DROP POLICY IF EXISTS iqube_events_update ON public.iqube_events;
DROP POLICY IF EXISTS iqube_events_delete ON public.iqube_events;

CREATE POLICY iqube_events_select ON public.iqube_events
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY iqube_events_insert ON public.iqube_events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY iqube_events_update ON public.iqube_events
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY iqube_events_delete ON public.iqube_events
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iqube_events TO authenticated;

-- ------------------------
-- iqube_capabilities
-- ------------------------
ALTER TABLE IF EXISTS public.iqube_capabilities ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.iqube_capabilities
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_iqube_capabilities_user_id ON public.iqube_capabilities (user_id);

DROP POLICY IF EXISTS iqube_capabilities_select ON public.iqube_capabilities;
DROP POLICY IF EXISTS iqube_capabilities_insert ON public.iqube_capabilities;
DROP POLICY IF EXISTS iqube_capabilities_update ON public.iqube_capabilities;
DROP POLICY IF EXISTS iqube_capabilities_delete ON public.iqube_capabilities;

CREATE POLICY iqube_capabilities_select ON public.iqube_capabilities
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY iqube_capabilities_insert ON public.iqube_capabilities
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY iqube_capabilities_update ON public.iqube_capabilities
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY iqube_capabilities_delete ON public.iqube_capabilities
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iqube_capabilities TO authenticated;

-- ------------------------
-- x402_settlements
-- ------------------------
ALTER TABLE IF EXISTS public.x402_settlements ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.x402_settlements
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_x402_settlements_user_id ON public.x402_settlements (user_id);

DROP POLICY IF EXISTS x402_settlements_select ON public.x402_settlements;
DROP POLICY IF EXISTS x402_settlements_insert ON public.x402_settlements;
DROP POLICY IF EXISTS x402_settlements_update ON public.x402_settlements;
DROP POLICY IF EXISTS x402_settlements_delete ON public.x402_settlements;

CREATE POLICY x402_settlements_select ON public.x402_settlements
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY x402_settlements_insert ON public.x402_settlements
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY x402_settlements_update ON public.x402_settlements
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY x402_settlements_delete ON public.x402_settlements
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.x402_settlements TO authenticated;

-- ------------------------
-- x402_messages
-- ------------------------
ALTER TABLE IF EXISTS public.x402_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.x402_messages
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_x402_messages_user_id ON public.x402_messages (user_id);

DROP POLICY IF EXISTS x402_messages_select ON public.x402_messages;
DROP POLICY IF EXISTS x402_messages_insert ON public.x402_messages;
DROP POLICY IF EXISTS x402_messages_update ON public.x402_messages;
DROP POLICY IF EXISTS x402_messages_delete ON public.x402_messages;

CREATE POLICY x402_messages_select ON public.x402_messages
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY x402_messages_insert ON public.x402_messages
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY x402_messages_update ON public.x402_messages
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY x402_messages_delete ON public.x402_messages
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.x402_messages TO authenticated;

-- ------------------------
-- identity_aliases
-- ------------------------
ALTER TABLE IF EXISTS public.identity_aliases ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.identity_aliases
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_identity_aliases_user_id ON public.identity_aliases (user_id);

DROP POLICY IF EXISTS identity_aliases_select ON public.identity_aliases;
DROP POLICY IF EXISTS identity_aliases_insert ON public.identity_aliases;
DROP POLICY IF EXISTS identity_aliases_update ON public.identity_aliases;
DROP POLICY IF EXISTS identity_aliases_delete ON public.identity_aliases;

CREATE POLICY identity_aliases_select ON public.identity_aliases
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY identity_aliases_insert ON public.identity_aliases
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY identity_aliases_update ON public.identity_aliases
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY identity_aliases_delete ON public.identity_aliases
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.identity_aliases TO authenticated;

-- ------------------------
-- fio_cache
-- ------------------------
ALTER TABLE IF EXISTS public.fio_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fio_cache_public_select ON public.fio_cache;
CREATE POLICY fio_cache_public_select ON public.fio_cache
  FOR SELECT TO public
  USING (true);

-- Note: No INSERT/UPDATE/DELETE policies for fio_cache (deny writes from authenticated/public)
-- Use SECURITY DEFINER functions or service_role for writes if required.

-- ------------------------
-- franchise_config
-- ------------------------
ALTER TABLE IF EXISTS public.franchise_config ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_franchise_config_franchise_id ON public.franchise_config (franchise_id);

DROP POLICY IF EXISTS franchise_config_select ON public.franchise_config;
DROP POLICY IF EXISTS franchise_config_insert ON public.franchise_config;
DROP POLICY IF EXISTS franchise_config_update ON public.franchise_config;
DROP POLICY IF EXISTS franchise_config_delete ON public.franchise_config;

CREATE POLICY franchise_config_select ON public.franchise_config
  FOR SELECT TO authenticated
  USING (franchise_id = (auth.jwt() ->> 'franchise_id')::uuid);

CREATE POLICY franchise_config_insert ON public.franchise_config
  FOR INSERT TO authenticated
  WITH CHECK (franchise_id = (auth.jwt() ->> 'franchise_id')::uuid);

CREATE POLICY franchise_config_update ON public.franchise_config
  FOR UPDATE TO authenticated
  USING (franchise_id = (auth.jwt() ->> 'franchise_id')::uuid)
  WITH CHECK (franchise_id = (auth.jwt() ->> 'franchise_id')::uuid);

CREATE POLICY franchise_config_delete ON public.franchise_config
  FOR DELETE TO authenticated
  USING (franchise_id = (auth.jwt() ->> 'franchise_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.franchise_config TO authenticated;

-- ------------------------
-- chat_history
-- ------------------------
ALTER TABLE IF EXISTS public.chat_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chat_history_tenant_id ON public.chat_history (tenant_id);

DROP POLICY IF EXISTS chat_history_select_tenant ON public.chat_history;
CREATE POLICY chat_history_select_tenant ON public.chat_history
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS chat_history_insert_tenant ON public.chat_history;
CREATE POLICY chat_history_insert_tenant ON public.chat_history
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS chat_history_update_tenant ON public.chat_history;
CREATE POLICY chat_history_update_tenant ON public.chat_history
  FOR UPDATE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS chat_history_delete_tenant ON public.chat_history;
CREATE POLICY chat_history_delete_tenant ON public.chat_history
  FOR DELETE TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ------------------------
-- claims
-- ------------------------
ALTER TABLE IF EXISTS public.claims ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS claims_claimant_did_idx ON public.claims (claimant_did);

DROP POLICY IF EXISTS claims_select_owner ON public.claims;
CREATE POLICY claims_select_owner ON public.claims
  FOR SELECT TO authenticated
  USING (claimant_did = (auth.jwt() ->> 'did'));

DROP POLICY IF EXISTS claims_insert_owner ON public.claims;
CREATE POLICY claims_insert_owner ON public.claims
  FOR INSERT TO authenticated
  WITH CHECK (claimant_did = (auth.jwt() ->> 'did'));

DROP POLICY IF EXISTS claims_update_owner ON public.claims;
CREATE POLICY claims_update_owner ON public.claims
  FOR UPDATE TO authenticated
  USING (claimant_did = (auth.jwt() ->> 'did'))
  WITH CHECK (claimant_did = (auth.jwt() ->> 'did'));

DROP POLICY IF EXISTS claims_delete_owner ON public.claims;
CREATE POLICY claims_delete_owner ON public.claims
  FOR DELETE TO authenticated
  USING (claimant_did = (auth.jwt() ->> 'did'));

COMMIT;
