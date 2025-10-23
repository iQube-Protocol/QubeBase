-- Fix 1: Update compliance function to use 'blak' schema and correct column names
CREATE OR REPLACE FUNCTION compliance.can_download_payload(p_payload_id uuid, p_user_id uuid, p_country_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'compliance', 'blak', 'public'
AS $$
DECLARE
    v_tenant_id UUID;
    v_is_blocked BOOLEAN;
    v_has_grant BOOLEAN;
BEGIN
    -- Get payload's tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM blak.payloads
    WHERE id = p_payload_id;

    IF v_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if country is blocked for this tenant
    SELECT EXISTS (
        SELECT 1
        FROM compliance.country_blocks cb
        WHERE cb.tenant_id = v_tenant_id
        AND cb.iso_country = p_country_code
        AND cb.blocked = true
    ) INTO v_is_blocked;

    IF v_is_blocked THEN
        RETURN FALSE;
    END IF;

    -- Check if user has explicit grant to this payload
    SELECT EXISTS (
        SELECT 1
        FROM blak.payload_grants
        WHERE payload_id = p_payload_id
        AND grantee_user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > now())
    ) INTO v_has_grant;

    RETURN v_has_grant;
END;
$$;

-- Fix 2: Create derivatives table
CREATE TABLE IF NOT EXISTS blak.derivatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload_id UUID NOT NULL REFERENCES blak.payloads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  uri TEXT NOT NULL,
  width INT,
  height INT,
  duration_s FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE blak.derivatives ENABLE ROW LEVEL SECURITY;

-- RLS policies for derivatives - allow viewing derivatives for payloads user has access to
CREATE POLICY "Users can view derivatives for their payloads"
ON blak.derivatives FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM blak.payload_grants
    WHERE payload_grants.payload_id = derivatives.payload_id
    AND payload_grants.grantee_user_id = auth.uid()
    AND (payload_grants.expires_at IS NULL OR payload_grants.expires_at > now())
  )
);

-- Service role can insert/update/delete derivatives
CREATE POLICY "Service role can manage derivatives"
ON blak.derivatives FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Fix 4: Create trigger for auto-tenant creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  admin_role_id uuid;
  user_email text;
BEGIN
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  -- Create personal tenant
  INSERT INTO public.tenants (name)
  VALUES (COALESCE(user_email, 'User') || '''s Organization')
  RETURNING id INTO new_tenant_id;
  
  -- Create admin role
  INSERT INTO public.roles (tenant_id, name)
  VALUES (new_tenant_id, 'admin')
  RETURNING id INTO admin_role_id;
  
  -- Assign user as admin
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (NEW.id, admin_role_id);
  
  RETURN NEW;
END;
$$;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;