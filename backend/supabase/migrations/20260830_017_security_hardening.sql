-- Security hardening: atomic tenant mutations, blocked-account preservation,
-- bounded metadata, and transactionally audited administrative changes.

alter table public.businesses
  drop constraint if exists businesses_name_length_check;
alter table public.businesses
  add constraint businesses_name_length_check
  check (char_length(trim(name)) between 1 and 80) not valid;

drop policy if exists profiles_authorized_select on public.profiles;
create policy profiles_authorized_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1 from public.business_members bm
    where bm.user_id = profiles.id
      and public.is_approved_owner(bm.business_id)
  )
);

-- Compatibility bootstrap: some existing installations predate migration 009
-- and only have the old five-argument analytics function. Define the current
-- signatures before changing their grants so this hardening migration can be
-- safely applied to those installations as well.
create or replace function public.business_date(
  p_timestamp timestamptz,
  p_timezone text,
  p_start_hour integer
) returns date
language sql
stable
parallel safe
set search_path = public
as $$
  select (((p_timestamp at time zone p_timezone) - make_interval(hours => p_start_hour))::date);
$$;

drop function if exists public.get_business_analytics(uuid, timestamptz, timestamptz, text, text);

create or replace function public.get_business_analytics(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text,
  p_timezone text,
  p_business_day_start_hour integer
)
returns table (
  bucket_key text,
  activity_type text,
  session_count bigint,
  total_seconds bigint,
  revenue numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_bucket not in ('hour', 'day', 'month') then
    raise exception 'Unsupported analytics bucket';
  end if;

  return query
  select
    case p_bucket
      when 'hour' then to_char(date_trunc('hour', s.ended_at at time zone 'UTC'), 'YYYY-MM-DD"T"HH24:MI')
      when 'day' then public.business_date(s.ended_at, p_timezone, p_business_day_start_hour)::text
      else to_char(public.business_date(s.ended_at, p_timezone, p_business_day_start_hour), 'YYYY-MM')
    end as bucket_key,
    st.type as activity_type,
    count(*)::bigint as session_count,
    coalesce(sum(s.final_elapsed_seconds), 0)::bigint as total_seconds,
    coalesce(sum(s.final_cost), 0)::numeric as revenue
  from public.sessions as s
  join public.stations as st
    on st.id = s.station_id and st.business_id = s.business_id
  where s.business_id = p_business_id
    and s.status = 'completed'
    and s.ended_at >= p_from
    and s.ended_at < p_to
  group by 1, st.type
  order by 1, st.type;
end;
$$;

revoke all on function public.business_date(timestamptz, text, integer)
  from public, anon, authenticated;
revoke all on function public.get_business_analytics(uuid, timestamptz, timestamptz, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.business_date(timestamptz, text, integer)
  to authenticated, service_role;
grant execute on function public.get_business_analytics(uuid, timestamptz, timestamptz, text, text, integer)
  to authenticated, service_role;

create or replace function public.provision_confirmed_owner(
  target_user_id uuid,
  business_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
  normalized_name text := coalesce(nullif(trim(business_name), ''), 'My Lounge');
begin
  if char_length(normalized_name) > 80 then
    raise exception 'BUSINESS_NAME_TOO_LONG';
  end if;

  select bm.business_id into new_business_id
  from public.business_members bm
  where bm.user_id = target_user_id and bm.role = 'owner'
  limit 1;

  if new_business_id is null then
    insert into public.businesses (name, created_by, status)
    values (normalized_name, target_user_id, 'pending_approval')
    returning id into new_business_id;

    insert into public.business_members (business_id, user_id, role, status)
    values (new_business_id, target_user_id, 'owner', 'active');
  end if;

  update public.profiles
  set account_status = 'pending_approval', account_type = 'owner'
  where id = target_user_id and account_status = 'pending_email';
  return new_business_id;
end;
$$;

revoke all on function public.provision_confirmed_owner(uuid, text)
  from public, anon, authenticated;

create or replace function public.accept_employee_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
) returns table (business_id uuid, invitation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  invitation public.employee_invitations%rowtype;
  existing_profile public.profiles%rowtype;
  stale_owner_business_ids uuid[];
begin
  select ei.* into invitation
  from public.employee_invitations as ei
  where ei.token_hash = p_token_hash
  for update;

  if invitation.id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  if invitation.status <> 'pending' then raise exception 'INVITATION_ALREADY_USED'; end if;
  if invitation.expires_at <= now() then raise exception 'INVITATION_EXPIRED'; end if;
  if lower(invitation.email) <> lower(p_email) then raise exception 'INVITATION_EMAIL_MISMATCH'; end if;

  select p.* into existing_profile
  from public.profiles as p
  where p.id = p_user_id
  for update;

  if existing_profile.id is not null and existing_profile.account_type <> 'employee' then
    raise exception 'ACCOUNT_TYPE_CONFLICT';
  end if;
  if existing_profile.account_status in ('suspended', 'deleted', 'rejected') then
    raise exception 'ACCOUNT_BLOCKED';
  end if;

  select array_agg(bm.business_id) into stale_owner_business_ids
  from public.business_members as bm
  where bm.user_id = p_user_id
    and bm.role = 'owner'
    and bm.business_id <> invitation.business_id;

  update public.business_members as bm
  set status = 'removed'
  where bm.user_id = p_user_id
    and bm.role = 'owner'
    and bm.business_id = any(coalesce(stale_owner_business_ids, array[]::uuid[]));

  update public.businesses as b
  set status = 'deleted'
  where b.created_by = p_user_id
    and b.id = any(coalesce(stale_owner_business_ids, array[]::uuid[]))
    and not exists (
      select 1 from public.business_members as other
      where other.business_id = b.id
        and other.user_id <> p_user_id
        and other.status = 'active'
    );

  insert into public.profiles (
    id, email, account_type, account_status, requires_password_setup
  ) values (
    p_user_id, lower(p_email), 'employee', 'approved', true
  )
  on conflict (id) do update set
    email = excluded.email,
    account_type = 'employee',
    account_status = 'approved',
    requires_password_setup = true;

  insert into public.business_members (business_id, user_id, role, status)
  values (invitation.business_id, p_user_id, 'employee', 'active')
  on conflict on constraint business_members_pkey
  do update set role = 'employee', status = 'active';

  update public.employee_invitations as ei
  set status = 'accepted', accepted_at = now()
  where ei.id = invitation.id;

  insert into public.admin_audit_logs (
    actor_user_id, target_user_id, business_id, action, metadata
  ) values (
    p_user_id, p_user_id, invitation.business_id, 'invitation.accept',
    jsonb_build_object('invitation_id', invitation.id)
  );

  return query select invitation.business_id, invitation.id;
end;
$$;

revoke all on function public.accept_employee_invitation(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.accept_employee_invitation(text, uuid, text)
  to service_role;

create or replace function public.sync_stations_atomic(
  p_business_id uuid,
  p_actor_user_id uuid,
  p_stations jsonb
)
returns table (outcome text, station_records jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  item_id text;
  item_type text;
  item_number integer;
  item_rate numeric;
  station_count integer;
begin
  if not exists (
    select 1
    from public.profiles p
    join public.business_members bm on bm.user_id = p.id
    join public.businesses b on b.id = bm.business_id
    where p.id = p_actor_user_id
      and bm.business_id = p_business_id
      and p.account_status = 'approved'
      and not p.requires_password_setup
      and bm.status = 'active'
      and bm.role = 'owner'
      and b.status = 'approved'
  ) then
    return query select 'forbidden'::text, null::jsonb;
    return;
  end if;

  if jsonb_typeof(p_stations) <> 'array' then
    return query select 'invalid_stations'::text, null::jsonb;
    return;
  end if;
  station_count := jsonb_array_length(p_stations);
  if station_count > 300 then
    return query select 'too_many_stations'::text, null::jsonb;
    return;
  end if;

  perform 1
  from public.stations s
  where s.business_id = p_business_id
  order by s.id
  for update;

  if exists (
    select 1
    from jsonb_array_elements(p_stations) j
    join public.stations s on s.id = j->>'id'
    where s.business_id <> p_business_id
  ) then
    return query select 'id_conflict'::text, null::jsonb;
    return;
  end if;

  if exists (
    select 1
    from public.stations s
    where s.business_id = p_business_id
      and s.archived_at is null
      and not exists (
        select 1 from jsonb_array_elements(p_stations) j where j->>'id' = s.id
      )
      and (
        s.status in ('active', 'paused')
        or exists (
          select 1 from public.sessions se
          where se.business_id = p_business_id
            and se.station_id = s.id
            and se.status in ('draft', 'active', 'paused')
        )
      )
  ) then
    return query select 'station_in_use'::text, null::jsonb;
    return;
  end if;

  for item in select value from jsonb_array_elements(p_stations)
  loop
    item_id := item->>'id';
    item_type := item->>'type';
    begin
      item_number := (item->>'number')::integer;
      item_rate := (item->>'hourlyRate')::numeric;
    exception when others then
      return query select 'invalid_stations'::text, null::jsonb;
      return;
    end;

    if item_id is null or item_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'
      or item_type not in ('billiard', 'pingpong', 'playstation')
      or item_number < 1 or item_number > 999
      or item_rate < 0 or item_rate > 999 then
      return query select 'invalid_stations'::text, null::jsonb;
      return;
    end if;

    insert into public.stations (
      id, business_id, type, number, hourly_rate, status, archived_at
    ) values (
      item_id, p_business_id, item_type, item_number, item_rate, 'available', null
    )
    on conflict (id) do update set
      type = excluded.type,
      number = excluded.number,
      hourly_rate = excluded.hourly_rate,
      archived_at = null
    where public.stations.business_id = p_business_id;
  end loop;

  update public.stations s
  set archived_at = now()
  where s.business_id = p_business_id
    and s.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(p_stations) j where j->>'id' = s.id
    );

  insert into public.admin_audit_logs (
    actor_user_id, business_id, action, metadata
  ) values (
    p_actor_user_id, p_business_id, 'stations.sync',
    jsonb_build_object('station_count', station_count)
  );

  return query
  select 'synchronized'::text, coalesce(jsonb_agg(to_jsonb(s) order by s.type, s.number), '[]'::jsonb)
  from public.stations s
  where s.business_id = p_business_id and s.archived_at is null;
exception
  when unique_violation then
    return query select 'conflict'::text, null::jsonb;
end;
$$;

revoke all on function public.sync_stations_atomic(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_stations_atomic(uuid, uuid, jsonb)
  to service_role;

create or replace function public.pause_session_atomic(
  p_business_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid,
  p_paused_at timestamptz
)
returns table (outcome text, session_record jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.sessions%rowtype;
  selected_pause timestamptz := coalesce(p_paused_at, now());
begin
  if not exists (
    select 1 from public.profiles p
    join public.business_members bm on bm.user_id = p.id
    join public.businesses b on b.id = bm.business_id
    where p.id = p_actor_user_id and bm.business_id = p_business_id
      and p.account_status = 'approved' and not p.requires_password_setup
      and bm.status = 'active' and bm.role in ('owner', 'employee')
      and b.status = 'approved'
  ) then return query select 'forbidden', null::jsonb; return; end if;

  select * into target_session from public.sessions
  where id = p_session_id and business_id = p_business_id for update;
  if not found then return query select 'not_found', null::jsonb; return; end if;
  if target_session.status <> 'active' then return query select 'invalid_transition', null::jsonb; return; end if;
  if selected_pause < target_session.started_at or selected_pause > now() then
    return query select 'invalid_time', null::jsonb; return;
  end if;

  perform 1 from public.stations
  where id = target_session.station_id and business_id = p_business_id for update;
  update public.sessions set status = 'paused', paused_at = selected_pause
  where id = p_session_id returning * into target_session;
  update public.stations set status = 'paused'
  where id = target_session.station_id and business_id = p_business_id and archived_at is null;
  if not found then raise exception 'Session station missing'; end if;
  return query select 'paused', to_jsonb(target_session);
end;
$$;

create or replace function public.resume_session_atomic(
  p_business_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid,
  p_resumed_at timestamptz
)
returns table (outcome text, session_record jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.sessions%rowtype;
  selected_resume timestamptz := coalesce(p_resumed_at, now());
  paused_seconds bigint;
begin
  if not exists (
    select 1 from public.profiles p
    join public.business_members bm on bm.user_id = p.id
    join public.businesses b on b.id = bm.business_id
    where p.id = p_actor_user_id and bm.business_id = p_business_id
      and p.account_status = 'approved' and not p.requires_password_setup
      and bm.status = 'active' and bm.role in ('owner', 'employee')
      and b.status = 'approved'
  ) then return query select 'forbidden', null::jsonb; return; end if;

  select * into target_session from public.sessions
  where id = p_session_id and business_id = p_business_id for update;
  if not found then return query select 'not_found', null::jsonb; return; end if;
  if target_session.status <> 'paused' then return query select 'invalid_transition', null::jsonb; return; end if;
  if selected_resume < target_session.paused_at or selected_resume > now() then
    return query select 'invalid_time', null::jsonb; return;
  end if;
  paused_seconds := greatest(0, floor(extract(epoch from selected_resume - target_session.paused_at))::bigint);

  perform 1 from public.stations
  where id = target_session.station_id and business_id = p_business_id for update;
  update public.sessions set
    status = 'active',
    paused_at = null,
    total_paused_seconds = target_session.total_paused_seconds + paused_seconds,
    pause_intervals = coalesce(target_session.pause_intervals, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('startedAt', target_session.paused_at, 'endedAt', selected_resume)
    )
  where id = p_session_id returning * into target_session;
  update public.stations set status = 'active'
  where id = target_session.station_id and business_id = p_business_id and archived_at is null;
  if not found then raise exception 'Session station missing'; end if;
  return query select 'resumed', to_jsonb(target_session);
end;
$$;

create or replace function public.update_open_session_atomic(
  p_business_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid,
  p_hourly_rate numeric,
  p_controller_count integer,
  p_started_at timestamptz
)
returns table (outcome text, session_record jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.sessions%rowtype;
  target_station public.stations%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    join public.business_members bm on bm.user_id = p.id
    join public.businesses b on b.id = bm.business_id
    where p.id = p_actor_user_id and bm.business_id = p_business_id
      and p.account_status = 'approved' and not p.requires_password_setup
      and bm.status = 'active' and bm.role in ('owner', 'employee')
      and b.status = 'approved'
  ) then return query select 'forbidden', null::jsonb; return; end if;

  select * into target_session from public.sessions
  where id = p_session_id and business_id = p_business_id for update;
  if not found then return query select 'not_found', null::jsonb; return; end if;
  if target_session.status not in ('draft', 'active', 'paused') then
    return query select 'invalid_transition', null::jsonb; return;
  end if;
  select * into target_station from public.stations
  where id = target_session.station_id and business_id = p_business_id for update;
  if not found then return query select 'station_not_found', null::jsonb; return; end if;
  if p_hourly_rate is not null and (p_hourly_rate < 0 or p_hourly_rate > 999) then
    return query select 'invalid_rate', null::jsonb; return;
  end if;
  if p_controller_count is not null and (
    p_controller_count < 1 or p_controller_count > 99 or target_station.type <> 'playstation'
  ) then return query select 'invalid_controller_count', null::jsonb; return; end if;
  if p_started_at is not null and p_started_at > now() then
    return query select 'invalid_time', null::jsonb; return;
  end if;

  update public.sessions set
    hourly_rate = coalesce(p_hourly_rate, hourly_rate),
    controller_count = coalesce(p_controller_count, controller_count),
    started_at = coalesce(p_started_at, started_at)
  where id = p_session_id returning * into target_session;
  insert into public.admin_audit_logs (actor_user_id, business_id, action, metadata)
  values (p_actor_user_id, p_business_id, 'session.update', jsonb_build_object(
    'session_id', p_session_id,
    'fields', jsonb_strip_nulls(jsonb_build_object(
      'hourly_rate', p_hourly_rate,
      'controller_count', p_controller_count,
      'started_at', p_started_at
    ))
  ));
  return query select 'updated', to_jsonb(target_session);
end;
$$;

create or replace function public.delete_draft_session_atomic(
  p_business_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.sessions%rowtype;
  actor_role text;
begin
  select bm.role into actor_role
  from public.profiles p
  join public.business_members bm on bm.user_id = p.id
  join public.businesses b on b.id = bm.business_id
  where p.id = p_actor_user_id and bm.business_id = p_business_id
    and p.account_status = 'approved' and not p.requires_password_setup
    and bm.status = 'active' and bm.role in ('owner', 'employee')
    and b.status = 'approved';
  if actor_role is null then return 'forbidden'; end if;

  select * into target_session from public.sessions
  where id = p_session_id and business_id = p_business_id for update;
  if not found then return 'not_found'; end if;
  if target_session.status <> 'draft' then return 'completed_history_protected'; end if;
  if actor_role = 'employee' and target_session.created_by <> p_actor_user_id then return 'forbidden'; end if;

  delete from public.sessions where id = p_session_id;
  insert into public.admin_audit_logs (actor_user_id, business_id, action, metadata)
  values (p_actor_user_id, p_business_id, 'session.draft_delete', jsonb_build_object('session_id', p_session_id));
  return 'deleted';
end;
$$;

revoke all on function public.pause_session_atomic(uuid, uuid, uuid, timestamptz),
  public.resume_session_atomic(uuid, uuid, uuid, timestamptz),
  public.update_open_session_atomic(uuid, uuid, uuid, numeric, integer, timestamptz),
  public.delete_draft_session_atomic(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.pause_session_atomic(uuid, uuid, uuid, timestamptz),
  public.resume_session_atomic(uuid, uuid, uuid, timestamptz),
  public.update_open_session_atomic(uuid, uuid, uuid, numeric, integer, timestamptz),
  public.delete_draft_session_atomic(uuid, uuid, uuid)
  to service_role;

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
    return query select 'self_change_denied', null::text, null::uuid; return;
  end if;
  if not exists (
    select 1 from public.platform_admins pa
    join public.profiles p on p.id = pa.user_id
    where pa.user_id = p_actor_user_id and p.account_status = 'approved'
  ) then return query select 'forbidden', null::text, null::uuid; return; end if;

  select * into target_profile from public.profiles
  where id = p_target_user_id for update;
  if not found or target_profile.account_type = 'platform_admin' then
    return query select 'not_found', null::text, null::uuid; return;
  end if;
  select * into target_membership from public.business_members
  where user_id = p_target_user_id and status <> 'removed'
  order by joined_at limit 1 for update;

  if p_action = 'remove' and target_profile.account_status <> 'deleted' then
    next_profile_status := 'deleted'; next_membership_status := 'removed'; next_business_status := 'deleted';
  elsif p_action = 'suspend' and target_profile.account_status = 'approved' then
    next_profile_status := 'suspended'; next_membership_status := 'disabled'; next_business_status := 'suspended';
  elsif p_action = 'reactivate' and target_profile.account_status = 'suspended' then
    next_profile_status := 'approved'; next_membership_status := 'active'; next_business_status := 'approved';
  elsif p_action = 'approve' and target_profile.account_type = 'owner'
    and target_profile.account_status = 'pending_approval' then
    next_profile_status := 'approved'; next_membership_status := 'active'; next_business_status := 'approved';
  elsif p_action = 'reject' and target_profile.account_type = 'owner'
    and target_profile.account_status = 'pending_approval' then
    next_profile_status := 'rejected'; next_membership_status := 'disabled'; next_business_status := 'rejected';
  else
    return query select 'invalid_action', target_profile.account_status, target_membership.business_id; return;
  end if;

  update public.profiles set account_status = next_profile_status where id = p_target_user_id;
  if target_membership.business_id is not null then
    update public.business_members set status = next_membership_status
    where user_id = p_target_user_id and business_id = target_membership.business_id;
    if target_membership.role = 'owner' then
      update public.businesses set status = next_business_status where id = target_membership.business_id;
    end if;
  end if;
  insert into public.admin_audit_logs (actor_user_id, target_user_id, business_id, action)
  values (p_actor_user_id, p_target_user_id, target_membership.business_id,
    case when target_profile.account_type = 'owner' then 'owner.' else 'user.' end || p_action);
  return query select 'updated', next_profile_status, target_membership.business_id;
end;
$$;

revoke all on function public.transition_managed_user_atomic(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.transition_managed_user_atomic(uuid, uuid, text)
  to service_role;

create or replace function public.update_managed_user_name_atomic(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_full_name text
)
returns table (outcome text, profile_record jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.profiles%rowtype;
  normalized_name text := trim(p_full_name);
begin
  if not exists (
    select 1 from public.platform_admins pa
    join public.profiles p on p.id = pa.user_id
    where pa.user_id = p_actor_user_id and p.account_status = 'approved'
  ) then return query select 'forbidden', null::jsonb; return; end if;
  if char_length(normalized_name) not between 1 and 100 then
    return query select 'invalid_name', null::jsonb; return;
  end if;
  select * into target_profile from public.profiles
  where id = p_target_user_id
    and account_type in ('owner', 'employee')
    and account_status <> 'deleted'
  for update;
  if not found then return query select 'not_found', null::jsonb; return; end if;
  update public.profiles set full_name = normalized_name
  where id = p_target_user_id returning * into target_profile;
  insert into public.admin_audit_logs (actor_user_id, target_user_id, action, metadata)
  values (p_actor_user_id, p_target_user_id, 'user.update', jsonb_build_object('fields', jsonb_build_array('full_name')));
  return query select 'updated', to_jsonb(target_profile);
end;
$$;

revoke all on function public.update_managed_user_name_atomic(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.update_managed_user_name_atomic(uuid, uuid, text)
  to service_role;
