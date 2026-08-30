-- RETURNS TABLE exposes business_id as a PL/pgSQL output variable. Qualify all
-- table columns so managed-user transitions do not fail with SQLSTATE 42702.
create or replace function public.transition_managed_user_atomic(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_action text
)
returns table (outcome text, account_status text, business_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.profiles%rowtype;
  target_membership public.business_members%rowtype;
  next_profile_status text;
  next_membership_status text;
  next_business_status text;
begin
  if p_actor_user_id = p_target_user_id then
    return query select 'self_change_denied', null::text, null::uuid;
    return;
  end if;

  if not exists (
    select 1
    from public.platform_admins as pa
    join public.profiles as actor_profile on actor_profile.id = pa.user_id
    where pa.user_id = p_actor_user_id
      and actor_profile.account_status = 'approved'
  ) then
    return query select 'forbidden', null::text, null::uuid;
    return;
  end if;

  select target.*
  into target_profile
  from public.profiles as target
  where target.id = p_target_user_id
  for update;

  if not found or target_profile.account_type = 'platform_admin' then
    return query select 'not_found', null::text, null::uuid;
    return;
  end if;

  select membership.*
  into target_membership
  from public.business_members as membership
  where membership.user_id = p_target_user_id
    and membership.status <> 'removed'
  order by membership.joined_at
  limit 1
  for update;

  if p_action = 'remove' and target_profile.account_status <> 'deleted' then
    next_profile_status := 'deleted';
    next_membership_status := 'removed';
    next_business_status := 'deleted';
  elsif p_action = 'suspend' and target_profile.account_status = 'approved' then
    next_profile_status := 'suspended';
    next_membership_status := 'disabled';
    next_business_status := 'suspended';
  elsif p_action = 'reactivate' and target_profile.account_status = 'suspended' then
    next_profile_status := 'approved';
    next_membership_status := 'active';
    next_business_status := 'approved';
  elsif p_action = 'approve'
    and target_profile.account_type = 'owner'
    and target_profile.account_status = 'pending_approval' then
    next_profile_status := 'approved';
    next_membership_status := 'active';
    next_business_status := 'approved';
  elsif p_action = 'reject'
    and target_profile.account_type = 'owner'
    and target_profile.account_status = 'pending_approval' then
    next_profile_status := 'rejected';
    next_membership_status := 'disabled';
    next_business_status := 'rejected';
  else
    return query
    select 'invalid_action', target_profile.account_status, target_membership.business_id;
    return;
  end if;

  update public.profiles as target
  set account_status = next_profile_status
  where target.id = p_target_user_id;

  if target_membership.business_id is not null then
    update public.business_members as membership
    set status = next_membership_status
    where membership.user_id = p_target_user_id
      and membership.business_id = target_membership.business_id;

    if target_membership.role = 'owner' then
      update public.businesses as target_business
      set status = next_business_status
      where target_business.id = target_membership.business_id;
    end if;
  end if;

  insert into public.admin_audit_logs (
    actor_user_id,
    target_user_id,
    business_id,
    action
  ) values (
    p_actor_user_id,
    p_target_user_id,
    target_membership.business_id,
    case
      when target_profile.account_type = 'owner' then 'owner.'
      else 'user.'
    end || p_action
  );

  return query
  select 'updated', next_profile_status, target_membership.business_id;
end;
$$;

revoke all on function public.transition_managed_user_atomic(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.transition_managed_user_atomic(uuid, uuid, text)
  to service_role;
