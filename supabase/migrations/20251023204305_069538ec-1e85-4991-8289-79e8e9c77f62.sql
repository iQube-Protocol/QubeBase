-- Add write policies for CRM tables to make them functional

-- CRM Contacts write policies
CREATE POLICY "Tenant members can insert contacts"
ON crm.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.tenant_id = contacts.tenant_id
  )
);

CREATE POLICY "Tenant members can update contacts"
ON crm.contacts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.tenant_id = contacts.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.tenant_id = contacts.tenant_id
  )
);

CREATE POLICY "Tenant admins can delete contacts"
ON crm.contacts
FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- CRM Accounts write policies
CREATE POLICY "Tenant members can insert accounts"
ON crm.accounts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.tenant_id = accounts.tenant_id
  )
);

CREATE POLICY "Tenant members can update accounts"
ON crm.accounts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.tenant_id = accounts.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.tenant_id = accounts.tenant_id
  )
);

CREATE POLICY "Tenant admins can delete accounts"
ON crm.accounts
FOR DELETE
TO authenticated
USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Add write policies for registry_mirror tables (defense-in-depth)
-- Only allow tenant admins to write to instances
CREATE POLICY "Tenant admins can manage instances"
ON registry_mirror.instances
FOR ALL
TO authenticated
USING (public.is_tenant_admin(auth.uid(), owner_tenant_id))
WITH CHECK (public.is_tenant_admin(auth.uid(), owner_tenant_id));

-- Proofs should be append-only, no updates or deletes allowed
CREATE POLICY "Service can append proofs"
ON registry_mirror.proofs
FOR INSERT
WITH CHECK (true); -- Service role bypasses this anyway

CREATE POLICY "No proof updates allowed"
ON registry_mirror.proofs
FOR UPDATE
USING (false);

CREATE POLICY "No proof deletions allowed"
ON registry_mirror.proofs
FOR DELETE
USING (false);