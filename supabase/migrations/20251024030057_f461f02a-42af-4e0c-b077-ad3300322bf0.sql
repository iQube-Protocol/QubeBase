-- Create app_nakamoto schema for Nakamoto migration data
CREATE SCHEMA IF NOT EXISTS app_nakamoto;

-- Create user_migration_map table to track Nakamoto -> QubeBase user ID mapping
CREATE TABLE IF NOT EXISTS app_nakamoto.user_migration_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id UUID NOT NULL,
  new_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  site_id UUID,
  migrated_at TIMESTAMPTZ DEFAULT now(),
  migration_metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(source_user_id, tenant_id)
);

-- Create interaction_history table for migrated user interactions
CREATE TABLE IF NOT EXISTS app_nakamoto.interaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app TEXT DEFAULT 'nakamoto',
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  persona_type TEXT,
  summarized BOOLEAN DEFAULT false,
  source_metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_migration_email ON app_nakamoto.user_migration_map(email);
CREATE INDEX IF NOT EXISTS idx_user_migration_new_user ON app_nakamoto.user_migration_map(new_user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_history_user ON app_nakamoto.interaction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_history_tenant ON app_nakamoto.interaction_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interaction_history_occurred ON app_nakamoto.interaction_history(occurred_at DESC);

-- Enable RLS on both tables
ALTER TABLE app_nakamoto.user_migration_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_nakamoto.interaction_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin access
CREATE POLICY "Allow authenticated users to read migration map"
  ON app_nakamoto.user_migration_map
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert migration records"
  ON app_nakamoto.user_migration_map
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read interaction history"
  ON app_nakamoto.interaction_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert interaction history"
  ON app_nakamoto.interaction_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);