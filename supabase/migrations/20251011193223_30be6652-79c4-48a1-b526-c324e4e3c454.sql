-- Core Schema Migration for QubeBase

-- ============================================================================
-- SCHEMAS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS black;
CREATE SCHEMA IF NOT EXISTS compliance;

-- ============================================================================
-- TABLES (in dependency order)
-- ============================================================================

-- black.payloads (no dependencies)
CREATE TABLE IF NOT EXISTS black.payloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    file_size_bytes BIGINT NOT NULL,
    content_type TEXT,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL
);

-- black.country_blocks (no dependencies)
CREATE TABLE IF NOT EXISTS compliance.country_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    country_code TEXT NOT NULL,
    blocked BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, country_code)
);

-- black.payload_grants (depends on black.payloads)
CREATE TABLE IF NOT EXISTS black.payload_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload_id UUID NOT NULL REFERENCES black.payloads(id) ON DELETE CASCADE,
    grantee_user_id UUID NOT NULL,
    granted_by UUID NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    UNIQUE(payload_id, grantee_user_id)
);

-- public.tenants (no dependencies)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- public.sites (depends on public.tenants)
CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- public.roles (depends on public.tenants)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

-- public.user_roles (depends on public.roles)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role_id)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: compliance.can_download_payload
CREATE OR REPLACE FUNCTION compliance.can_download_payload(
    p_payload_id UUID,
    p_user_id UUID,
    p_country_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_tenant_id UUID;
    v_is_blocked BOOLEAN;
    v_has_grant BOOLEAN;
BEGIN
    -- Get tenant_id from payload
    SELECT tenant_id INTO v_tenant_id
    FROM black.payloads
    WHERE id = p_payload_id;
    
    IF v_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if country is blocked
    SELECT blocked INTO v_is_blocked
    FROM compliance.country_blocks
    WHERE tenant_id = v_tenant_id AND country_code = p_country_code;
    
    IF v_is_blocked = TRUE THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user has grant
    SELECT EXISTS(
        SELECT 1 FROM black.payload_grants
        WHERE payload_id = p_payload_id 
        AND grantee_user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > now())
    ) INTO v_has_grant;
    
    RETURN v_has_grant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE black.payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE black.payload_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance.country_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for black.payloads
CREATE POLICY "Users can view payloads in their tenant"
    ON black.payloads FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.tenant_id = black.payloads.tenant_id
        )
    );

CREATE POLICY "Users can insert payloads in their tenant"
    ON black.payloads FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.tenant_id = black.payloads.tenant_id
        )
    );

-- Policies for black.payload_grants
CREATE POLICY "Users can view grants for their payloads"
    ON black.payload_grants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM black.payloads p
            JOIN public.user_roles ur ON ur.user_id = auth.uid()
            JOIN public.roles r ON ur.role_id = r.id
            WHERE p.id = black.payload_grants.payload_id
            AND r.tenant_id = p.tenant_id
        )
    );

CREATE POLICY "Users can create grants for their payloads"
    ON black.payload_grants FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM black.payloads p
            JOIN public.user_roles ur ON ur.user_id = auth.uid()
            JOIN public.roles r ON ur.role_id = r.id
            WHERE p.id = black.payload_grants.payload_id
            AND r.tenant_id = p.tenant_id
        )
    );

-- Policies for compliance.country_blocks
CREATE POLICY "Users can view country blocks in their tenant"
    ON compliance.country_blocks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.tenant_id = compliance.country_blocks.tenant_id
        )
    );

CREATE POLICY "Users can manage country blocks in their tenant"
    ON compliance.country_blocks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.tenant_id = compliance.country_blocks.tenant_id
        )
    );

-- Policies for public.tenants
CREATE POLICY "Users can view their tenants"
    ON public.tenants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.tenant_id = public.tenants.id
        )
    );

-- Policies for public.sites
CREATE POLICY "Users can view sites in their tenant"
    ON public.sites FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.tenant_id = public.sites.tenant_id
        )
    );

-- Policies for public.roles
CREATE POLICY "Users can view roles in their tenant"
    ON public.roles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.tenant_id = public.roles.tenant_id
        )
    );

-- Policies for public.user_roles
CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (user_id = auth.uid());

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payloads_tenant_id ON black.payloads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payload_grants_payload_id ON black.payload_grants(payload_id);
CREATE INDEX IF NOT EXISTS idx_payload_grants_grantee ON black.payload_grants(grantee_user_id);
CREATE INDEX IF NOT EXISTS idx_country_blocks_tenant_id ON compliance.country_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_tenant_id ON public.sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON public.roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);