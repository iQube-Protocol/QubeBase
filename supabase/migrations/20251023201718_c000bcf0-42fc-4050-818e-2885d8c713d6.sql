-- Add UPDATE and DELETE policies for black.payloads table
CREATE POLICY "Users can update their own payloads"
ON black.payloads
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (
    SELECT r.tenant_id FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
  )
  AND created_by = auth.uid()
)
WITH CHECK (
  tenant_id IN (
    SELECT r.tenant_id FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can delete their own payloads"
ON black.payloads
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT r.tenant_id FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Add DELETE policy for black.payload_grants (grants should be revocable)
CREATE POLICY "Users can revoke grants they issued"
ON black.payload_grants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM black.payloads p
    WHERE p.id = payload_grants.payload_id
      AND p.created_by = auth.uid()
  )
);