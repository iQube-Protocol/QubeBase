-- Fix infinite recursion in roles table RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view roles in their tenant" ON public.roles;

-- Create a helper function to check if user belongs to a tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND r.tenant_id = _tenant_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.user_belongs_to_tenant(uuid, uuid) TO authenticated;

-- Create new non-recursive policy for roles
CREATE POLICY "Users can view roles in their tenant"
ON public.roles
FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Also fix sites and tenants policies to use the same pattern
DROP POLICY IF EXISTS "Users can view sites in their tenant" ON public.sites;
CREATE POLICY "Users can view sites in their tenant"
ON public.sites
FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "Users can view their tenants" ON public.tenants;
CREATE POLICY "Users can view their tenants"
ON public.tenants
FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), id));