-- Fix function search path security issue

CREATE OR REPLACE FUNCTION compliance.can_download_payload(
    p_payload_id UUID,
    p_user_id UUID,
    p_country_code TEXT
)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
STABLE
SECURITY DEFINER
SET search_path = compliance, black, public
AS $$
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
$$;