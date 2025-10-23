-- Fix compliance.can_download_payload function to prevent search_path manipulation
CREATE OR REPLACE FUNCTION compliance.can_download_payload(
    p_payload_id UUID,
    p_user_id UUID,
    p_country_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = compliance, black, public
AS $$
DECLARE
    v_tenant_id UUID;
    v_is_blocked BOOLEAN;
    v_has_grant BOOLEAN;
BEGIN
    -- Get payload's tenant_id using fully qualified name
    SELECT tenant_id INTO v_tenant_id
    FROM black.payloads
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
        FROM black.payload_grants pg
        WHERE pg.payload_id = p_payload_id
        AND pg.subject_type = 'user'
        AND pg.subject_id = p_user_id
    ) INTO v_has_grant;

    RETURN v_has_grant;
END;
$$;