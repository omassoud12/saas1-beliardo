create index if not exists business_members_user_joined_active_idx
  on public.business_members (user_id, joined_at)
  where status <> 'removed';

create index if not exists sessions_business_open_started_idx
  on public.sessions (business_id, started_at)
  where status in ('active', 'paused');

create or replace function public.get_request_access_context(
  p_user_id uuid,
  p_business_id uuid default null
)
returns table (
  profile jsonb,
  is_platform_admin boolean,
  business_id uuid,
  role text,
  membership_status text,
  business_status text,
  timezone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'account_type', p.account_type,
      'account_status', p.account_status,
      'requires_password_setup', p.requires_password_setup
    ),
    exists (select 1 from public.platform_admins pa where pa.user_id = p_user_id),
    membership.business_id,
    membership.role,
    membership.status,
    membership.business_status,
    coalesce(membership.timezone, 'UTC')
  from public.profiles p
  left join lateral (
    select bm.business_id, bm.role, bm.status, b.status as business_status, b.timezone
    from public.business_members bm
    join public.businesses b on b.id = bm.business_id
    where bm.user_id = p_user_id
      and bm.status <> 'removed'
      and (p_business_id is null or bm.business_id = p_business_id)
    order by bm.joined_at asc
    limit 1
  ) membership on true
  where p.id = p_user_id;
$$;

revoke all on function public.get_request_access_context(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_request_access_context(uuid, uuid) to service_role;
