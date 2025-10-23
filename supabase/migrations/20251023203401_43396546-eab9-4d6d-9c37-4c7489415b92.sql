-- Update registry_mirror RLS policies to distinguish public chain vs private library items

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Templates are publicly readable" ON registry_mirror.templates;
DROP POLICY IF EXISTS "Instances are publicly readable" ON registry_mirror.instances;
DROP POLICY IF EXISTS "Proofs are publicly readable" ON registry_mirror.proofs;

-- Templates: Public if marked as public chain, authenticated users can see all (templates are shared resources)
CREATE POLICY "Public chain templates are readable by everyone"
ON registry_mirror.templates
FOR SELECT
USING (
  meta_public->>'is_public_chain' = 'true'
);

CREATE POLICY "Authenticated users can view private templates"
ON registry_mirror.templates
FOR SELECT
TO authenticated
USING (
  meta_public->>'is_public_chain' != 'true'
  OR meta_public->>'is_public_chain' IS NULL
);

-- Instances: Public if on public registry, private if in user's library
CREATE POLICY "Public registry instances are readable by everyone"
ON registry_mirror.instances
FOR SELECT
USING (
  meta_public->>'is_public_chain' = 'true'
);

CREATE POLICY "Private library instances readable by tenant members"
ON registry_mirror.instances
FOR SELECT
TO authenticated
USING (
  (meta_public->>'is_public_chain' != 'true' OR meta_public->>'is_public_chain' IS NULL)
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.tenant_id = instances.owner_tenant_id
  )
);

-- Proofs: Public for public chain instances without blakQube payloads
-- Private for instances in user's library or with blakQube payloads
CREATE POLICY "Public chain proofs readable by everyone"
ON registry_mirror.proofs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM registry_mirror.instances i
    WHERE i.id = proofs.instance_id
    AND i.meta_public->>'is_public_chain' = 'true'
    AND i.black_pointer IS NULL
  )
);

CREATE POLICY "Private library proofs readable by tenant members"
ON registry_mirror.proofs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM registry_mirror.instances i
    JOIN user_roles ur ON TRUE
    JOIN roles r ON ur.role_id = r.id
    WHERE i.id = proofs.instance_id
    AND ur.user_id = auth.uid()
    AND r.tenant_id = i.owner_tenant_id
    AND (
      i.meta_public->>'is_public_chain' != 'true'
      OR i.meta_public->>'is_public_chain' IS NULL
      OR i.black_pointer IS NOT NULL
    )
  )
);