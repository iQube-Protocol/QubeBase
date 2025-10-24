-- Secure function to get a user's tenant without triggering RLS recursion on roles
create or replace function public.get_user_tenant(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.tenant_id
  from public.user_roles ur
  join public.roles r on ur.role_id = r.id
  where ur.user_id = _user_id
  order by ur.assigned_at asc
  limit 1
$$;

-- Ensure authenticated users can call it
grant execute on function public.get_user_tenant(uuid) to authenticated;