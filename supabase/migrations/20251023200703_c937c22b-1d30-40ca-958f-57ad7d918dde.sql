-- Fix critical RLS policy gaps for sites, tenants, and user_roles tables

-- First, create a helper function to check if user is admin in a tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND r.tenant_id = _tenant_id
      AND r.name = 'admin'
  )
$$;

-- Sites table policies
CREATE POLICY "Tenant admins can insert sites"
ON public.sites
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update sites"
ON public.sites
FOR UPDATE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete sites"
ON public.sites
FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Tenants table policies (restricted - only platform admins or system can create tenants)
CREATE POLICY "No direct tenant insertion"
ON public.tenants
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Tenant admins can update their tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), id))
WITH CHECK (public.is_tenant_admin(auth.uid(), id));

CREATE POLICY "No direct tenant deletion"
ON public.tenants
FOR DELETE
TO authenticated
USING (false);

-- User roles table policies (critical - prevent privilege escalation)
CREATE POLICY "Tenant admins can assign roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM roles r
    WHERE r.id = user_roles.role_id
      AND public.is_tenant_admin(auth.uid(), r.tenant_id)
  )
);

CREATE POLICY "No role updates allowed"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Tenant admins can revoke roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM roles r
    WHERE r.id = user_roles.role_id
      AND public.is_tenant_admin(auth.uid(), r.tenant_id)
  )
);

-- Roles table policies
CREATE POLICY "Tenant admins can create roles"
ON public.roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update roles"
ON public.roles
FOR UPDATE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete roles"
ON public.roles
FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));