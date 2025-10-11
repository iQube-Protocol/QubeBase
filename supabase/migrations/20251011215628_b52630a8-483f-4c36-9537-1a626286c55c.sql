-- Add CRM schema and tables
CREATE SCHEMA IF NOT EXISTS crm;

CREATE TABLE crm.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT,
  phone TEXT,
  name TEXT,
  meta JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE crm.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  domain TEXT,
  meta JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE crm.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for CRM
CREATE POLICY "Users can view contacts in their tenant"
  ON crm.contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.tenant_id = contacts.tenant_id
  ));

CREATE POLICY "Users can view accounts in their tenant"
  ON crm.accounts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.tenant_id = accounts.tenant_id
  ));

-- Add Registry Mirror schema and tables
CREATE SCHEMA IF NOT EXISTS registry_mirror;

CREATE TABLE registry_mirror.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  meta_public JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE registry_mirror.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES registry_mirror.templates(id) ON DELETE CASCADE,
  owner_tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta_public JSONB DEFAULT '{}'::jsonb,
  black_pointer UUID,
  tokenqube_key_id TEXT
);

CREATE TABLE registry_mirror.proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES registry_mirror.instances(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  txid TEXT NOT NULL,
  chain TEXT NOT NULL,
  block_height BIGINT,
  proof_type TEXT NOT NULL,
  signature TEXT
);

CREATE TABLE registry_mirror.entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES registry_mirror.instances(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE registry_mirror.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_mirror.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_mirror.proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE registry_mirror.entitlements ENABLE ROW LEVEL SECURITY;

-- RLS policies for Registry Mirror (publicly readable for now, webhook writes with service role)
CREATE POLICY "Templates are publicly readable"
  ON registry_mirror.templates FOR SELECT
  USING (true);

CREATE POLICY "Instances are publicly readable"
  ON registry_mirror.instances FOR SELECT
  USING (true);

CREATE POLICY "Proofs are publicly readable"
  ON registry_mirror.proofs FOR SELECT
  USING (true);

CREATE POLICY "Users can view entitlements for their tenant"
  ON registry_mirror.entitlements FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.tenant_id = entitlements.tenant_id
  ));

-- Add indexes for performance
CREATE INDEX idx_contacts_tenant ON crm.contacts(tenant_id);
CREATE INDEX idx_accounts_tenant ON crm.accounts(tenant_id);
CREATE INDEX idx_instances_template ON registry_mirror.instances(template_id);
CREATE INDEX idx_instances_tenant ON registry_mirror.instances(owner_tenant_id);
CREATE INDEX idx_proofs_instance ON registry_mirror.proofs(instance_id);
CREATE INDEX idx_entitlements_instance ON registry_mirror.entitlements(instance_id);
CREATE INDEX idx_entitlements_tenant ON registry_mirror.entitlements(tenant_id);