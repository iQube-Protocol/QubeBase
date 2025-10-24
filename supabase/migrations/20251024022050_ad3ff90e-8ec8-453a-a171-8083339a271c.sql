-- Create Nakamoto migration schemas and tables

-- Create app_nakamoto schema for Nakamoto-specific tables
CREATE SCHEMA IF NOT EXISTS app_nakamoto;

-- Create kb schema for knowledge base
CREATE SCHEMA IF NOT EXISTS kb;

-- Create prompts schema for system prompts
CREATE SCHEMA IF NOT EXISTS prompts;

-- ============================================
-- app_nakamoto.user_migration_map
-- Tracks user ID mapping between Nakamoto and QubeBase
-- ============================================
CREATE TABLE app_nakamoto.user_migration_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id uuid NOT NULL,
  new_user_id uuid NOT NULL,
  email text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  site_id uuid REFERENCES public.sites(id),
  migrated_at timestamptz NOT NULL DEFAULT now(),
  migration_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(source_user_id),
  UNIQUE(new_user_id)
);

CREATE INDEX idx_user_migration_email ON app_nakamoto.user_migration_map(email);
CREATE INDEX idx_user_migration_tenant ON app_nakamoto.user_migration_map(tenant_id);

-- ============================================
-- app_nakamoto.interaction_history
-- Migrated interaction histories
-- ============================================
CREATE TABLE app_nakamoto.interaction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app text NOT NULL DEFAULT 'nakamoto',
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  query_text text NOT NULL,
  response_text text NOT NULL,
  interaction_type text NOT NULL,
  persona_type text,
  summarized boolean NOT NULL DEFAULT false,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interaction_user ON app_nakamoto.interaction_history(user_id);
CREATE INDEX idx_interaction_tenant ON app_nakamoto.interaction_history(tenant_id);
CREATE INDEX idx_interaction_occurred ON app_nakamoto.interaction_history(occurred_at DESC);

-- ============================================
-- kb.corpora
-- Knowledge base collections
-- ============================================
CREATE TABLE kb.corpora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  app text NOT NULL,
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('root', 'tenant')),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, app, name)
);

CREATE INDEX idx_corpora_tenant_app ON kb.corpora(tenant_id, app);
CREATE INDEX idx_corpora_scope ON kb.corpora(scope) WHERE is_active = true;

-- ============================================
-- kb.docs
-- Knowledge base documents
-- ============================================
CREATE TABLE kb.docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_id uuid NOT NULL REFERENCES kb.corpora(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  title text NOT NULL,
  content_text text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'text/markdown',
  tags text[] NOT NULL DEFAULT '{}',
  storage_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(corpus_id, title)
);

CREATE INDEX idx_docs_corpus ON kb.docs(corpus_id) WHERE is_active = true;
CREATE INDEX idx_docs_tenant ON kb.docs(tenant_id);
CREATE INDEX idx_docs_tags ON kb.docs USING gin(tags);

-- ============================================
-- kb.v_effective_docs (View)
-- Combines root and tenant-specific active documents
-- ============================================
CREATE OR REPLACE VIEW kb.v_effective_docs AS
SELECT 
  d.id,
  d.corpus_id,
  d.tenant_id,
  d.title,
  d.content_text,
  d.content_type,
  d.tags,
  d.storage_path,
  d.metadata,
  d.version,
  c.app,
  c.scope,
  c.name as corpus_name
FROM kb.docs d
JOIN kb.corpora c ON d.corpus_id = c.id
WHERE d.is_active = true AND c.is_active = true;

-- ============================================
-- prompts.prompts
-- System prompts for AI agents
-- ============================================
CREATE TABLE prompts.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  scope text NOT NULL CHECK (scope IN ('root', 'tenant')),
  prompt_key text NOT NULL,
  prompt_text text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'draft')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(app, tenant_id, prompt_key, scope)
);

CREATE INDEX idx_prompts_app_key ON prompts.prompts(app, prompt_key) WHERE status = 'active';
CREATE INDEX idx_prompts_tenant ON prompts.prompts(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================
-- prompts.v_effective_prompt (View)
-- Resolves tenant-specific overrides over root prompts
-- ============================================
CREATE OR REPLACE VIEW prompts.v_effective_prompt AS
SELECT DISTINCT ON (app, prompt_key, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  id,
  app,
  tenant_id,
  scope,
  prompt_key,
  prompt_text,
  version,
  status,
  metadata
FROM prompts.prompts
WHERE status = 'active'
ORDER BY 
  app, 
  prompt_key, 
  COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  scope DESC; -- 'tenant' comes before 'root' alphabetically

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE app_nakamoto.user_migration_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_nakamoto.interaction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb.corpora ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb.docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts.prompts ENABLE ROW LEVEL SECURITY;

-- Policies for user_migration_map (admin only)
CREATE POLICY "Tenant admins can view migration map"
  ON app_nakamoto.user_migration_map FOR SELECT
  USING (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert migration map"
  ON app_nakamoto.user_migration_map FOR INSERT
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- Policies for interaction_history
CREATE POLICY "Users can view their own interactions"
  ON app_nakamoto.interaction_history FOR SELECT
  USING (user_id = auth.uid() OR is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert interactions"
  ON app_nakamoto.interaction_history FOR INSERT
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

-- Policies for kb.corpora
CREATE POLICY "Users can view corpora in their tenant"
  ON kb.corpora FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage corpora"
  ON kb.corpora FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id));

-- Policies for kb.docs
CREATE POLICY "Users can view docs in their tenant"
  ON kb.docs FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage docs"
  ON kb.docs FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id));

-- Policies for prompts.prompts
CREATE POLICY "Users can view prompts in their tenant"
  ON prompts.prompts FOR SELECT
  USING (tenant_id IS NULL OR user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage tenant prompts"
  ON prompts.prompts FOR ALL
  USING (tenant_id IS NOT NULL AND is_tenant_admin(auth.uid(), tenant_id));

-- Grant schema usage
GRANT USAGE ON SCHEMA app_nakamoto TO authenticated;
GRANT USAGE ON SCHEMA kb TO authenticated;
GRANT USAGE ON SCHEMA prompts TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT ON app_nakamoto.user_migration_map TO authenticated;
GRANT SELECT, INSERT ON app_nakamoto.interaction_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON kb.corpora TO authenticated;
GRANT SELECT, INSERT, UPDATE ON kb.docs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON prompts.prompts TO authenticated;