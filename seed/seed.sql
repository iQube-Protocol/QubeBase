-- Run after migrations are applied.
-- NOTE: In local dev, you can mock auth by inserting into iam.users directly.
-- In prod, mirror auth.users.id into iam.users.id via your signup flow.

-- === Users (mock) ===
-- Generate stable UUIDs once for repeatable seeds.
do $$
declare
  v_uber uuid := gen_random_uuid();
  v_alice uuid := gen_random_uuid();
  v_bob uuid := gen_random_uuid();
  v_tenant uuid;
  v_site_nakamoto uuid;
  v_site_kn0w1 uuid;
  v_site_moneypenny uuid;
begin
  -- Insert users
  insert into iam.users(id, email, status)
  values (v_uber, 'uber.admin@example.com', 'active'),
         (v_alice, 'alice@example.com', 'active'),
         (v_bob, 'bob@example.com', 'active');

  -- === Platform tenant & sites ===
  insert into iam.tenants(name)
  values ('Platform Tenant')
  returning id into v_tenant;

  -- Sites
  insert into iam.sites(tenant_id, app, slug)
  values (v_tenant, 'nakamoto', 'platform-nakamoto'),
         (v_tenant, 'kn0w1', 'platform-kn0w1'),
         (v_tenant, 'moneypenny', 'platform-moneypenny')
  returning id into v_site_nakamoto;

  -- Grab others
  select id into v_site_kn0w1 from iam.sites where tenant_id=v_tenant and app='kn0w1';
  select id into v_site_moneypenny from iam.sites where tenant_id=v_tenant and app='moneypenny';

  -- Memberships
  insert into iam.user_memberships(user_id, tenant_id, role)
  values (v_uber, v_tenant, 'uber_admin'),
         (v_alice, v_tenant, 'site_admin'),
         (v_bob, v_tenant, 'editor')
  on conflict do nothing;

  insert into iam.site_memberships(user_id, site_id, role)
  values (v_alice, v_site_kn0w1, 'site_admin'),
         (v_bob, v_site_kn0w1, 'editor'),
         (v_bob, v_site_nakamoto, 'viewer')
  on conflict do nothing;

  -- CRM samples
  insert into crm.contacts(tenant_id, user_id, name, email, phone)
  values (v_tenant, v_alice, 'Alice Example', 'alice@example.com', '+1-555-0100'),
         (v_tenant, v_bob, 'Bob Example', 'bob@example.com', '+1-555-0101');

  insert into crm.accounts(tenant_id, name)
  values (v_tenant, 'Example Account');

  -- Registry mirror sample
  insert into registry_mirror.templates(name, meta_public)
  values ('ContentQube.Template.v1', '{"schema":"content"}')
  returning id into strict v_site_nakamoto; -- reuse var

  insert into registry_mirror.instances(template_id, owner_tenant_id, meta_public, blak_pointer, tokenqube_key_id)
  values (v_site_nakamoto, v_tenant, '{"title":"Hello World"}', 'cid://placeholder', 'keyref-demo');

  -- Billing account for tenant
  insert into billing.accounts(tenant_id, app, site_id)
  values (v_tenant, 'kn0w1', v_site_kn0w1);

  raise notice 'Seed data loaded successfully!';
end $$;
