-- Seed data for QubeBase Core Hub
-- Creates platform tenant, uber admin, test users, and sites

-- Create uber admin user (use known UUID for testing)
INSERT INTO iam.users (id, email, status) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@agentiq.ai', 'active'),
('00000000-0000-0000-0000-000000000002', 'alice@example.com', 'active'),
('00000000-0000-0000-0000-000000000003', 'bob@example.com', 'active')
ON CONFLICT (id) DO NOTHING;

-- Create platform tenant
INSERT INTO iam.tenants (id, name) VALUES
('10000000-0000-0000-0000-000000000001', 'AgentiQ Platform')
ON CONFLICT (id) DO NOTHING;

-- Create sites for each app
INSERT INTO iam.sites (id, tenant_id, app, slug) VALUES
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'nakamoto', 'nakamoto-main'),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'kn0w1', 'kn0w1-main'),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'moneypenny', 'moneypenny-main')
ON CONFLICT (id) DO NOTHING;

-- Assign memberships
INSERT INTO iam.user_memberships (user_id, tenant_id, role) VALUES
('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'uber_admin'),
('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'editor'),
('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'viewer')
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Create second tenant for RLS testing
INSERT INTO iam.tenants (id, name) VALUES
('10000000-0000-0000-0000-000000000002', 'Test Franchise')
ON CONFLICT (id) DO NOTHING;

INSERT INTO iam.user_memberships (user_id, tenant_id, role) VALUES
('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'franchise_admin')
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Sample CRM contacts
INSERT INTO crm.contacts (tenant_id, name, email) VALUES
('10000000-0000-0000-0000-000000000001', 'Jane Doe', 'jane@example.com'),
('10000000-0000-0000-0000-000000000001', 'John Smith', 'john@example.com'),
('10000000-0000-0000-0000-000000000002', 'Bob Johnson', 'bob.j@example.com');

-- Sample registry templates
INSERT INTO registry_mirror.templates (id, name, meta_public) VALUES
('30000000-0000-0000-0000-000000000001', 'Media Asset NFT', '{"type":"media","blockchain":"bitcoin"}'),
('30000000-0000-0000-0000-000000000002', 'Knowledge Token', '{"type":"knowledge","blockchain":"icp"}')
ON CONFLICT (id) DO NOTHING;

-- Sample agentic tools
INSERT INTO agentic.tools (name, spec_json, version) VALUES
('web_search', '{"description":"Search the web","parameters":{"query":"string"}}', '1.0.0'),
('image_gen', '{"description":"Generate images","parameters":{"prompt":"string"}}', '1.0.0');

-- Sample billing account
INSERT INTO billing.accounts (tenant_id, app) VALUES
('10000000-0000-0000-0000-000000000001', 'nakamoto');

-- Sample DID/FIO setup for admin user
INSERT INTO did.identities (id, did_uri, user_id) VALUES
('40000000-0000-0000-0000-000000000001', 'did:web:agentiq.ai:admin', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO did.personas (id, did_id, name, policy_json) VALUES
('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Admin Persona', '{"private_by_default":true}')
ON CONFLICT (id) DO NOTHING;

-- Auto-bind default FIO handle
SELECT fio.bind_default_handle('50000000-0000-0000-0000-000000000001', 'admin');

-- Sample compliance data
INSERT INTO compliance.kyc_attestations (user_id, provider, level, issued_at) VALUES
('00000000-0000-0000-0000-000000000001', 'test_provider', 'level_2', now());

SELECT 'Seed data loaded successfully!' as status;
