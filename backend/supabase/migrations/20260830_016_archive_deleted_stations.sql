alter table public.stations
  add column if not exists archived_at timestamptz;

alter table public.stations
  drop constraint if exists stations_business_type_number_key;

create unique index if not exists stations_business_active_type_number_key
  on public.stations (business_id, type, number)
  where archived_at is null;

create or replace function public.start_session_atomic(
  p_business_id uuid,
  p_started_by uuid,
  p_station_id text,
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
  target_station public.stations%rowtype;
  target_session public.sessions%rowtype;
  selected_started_at timestamptz := coalesce(p_started_at, now());
  selected_hourly_rate numeric;
  selected_controller_count integer := coalesce(p_controller_count, 1);
begin
  if not exists (
    select 1
    from public.profiles p
    join public.business_members bm on bm.user_id = p.id
    join public.businesses b on b.id = bm.business_id
    where p.id = p_started_by
      and bm.business_id = p_business_id
      and p.account_status = 'approved'
      and not p.requires_password_setup
      and bm.status = 'active'
      and bm.role in ('owner', 'employee')
      and b.status = 'approved'
  ) then
    return query select 'forbidden'::text, null::jsonb;
    return;
  end if;

  select s.*
  into target_station
  from public.stations s
  where s.id = p_station_id
    and s.business_id = p_business_id
    and s.archived_at is null
  for update;

  if not found then
    return query select 'station_not_found'::text, null::jsonb;
    return;
  end if;

  if target_station.status <> 'available' then
    return query select 'station_unavailable'::text, null::jsonb;
    return;
  end if;

  if exists (
    select 1
    from public.sessions s
    where s.business_id = p_business_id
      and s.station_id = p_station_id
      and s.status in ('draft', 'active', 'paused')
  ) then
    return query select 'open_session_exists'::text, null::jsonb;
    return;
  end if;

  if selected_started_at > now() then
    return query select 'invalid_start_time'::text, null::jsonb;
    return;
  end if;

  if selected_controller_count < 1 or selected_controller_count > 99 then
    return query select 'invalid_controller_count'::text, null::jsonb;
    return;
  end if;

  if target_station.type <> 'playstation' and selected_controller_count <> 1 then
    return query select 'controller_count_not_allowed'::text, null::jsonb;
    return;
  end if;

  selected_hourly_rate := coalesce(p_hourly_rate, target_station.hourly_rate);

  insert into public.sessions (
    business_id, station_id, status, hourly_rate, controller_count, started_at,
    paused_at, total_paused_seconds, pause_intervals, created_by
  ) values (
    p_business_id, p_station_id, 'active', selected_hourly_rate,
    case when target_station.type = 'playstation' then selected_controller_count else 1 end,
    selected_started_at, null, 0, '[]'::jsonb, p_started_by
  )
  returning * into target_session;

  update public.stations
  set status = 'active'
  where id = p_station_id
    and business_id = p_business_id
    and archived_at is null;

  if not found then
    raise exception 'Session station was not found';
  end if;

  return query select 'started'::text, to_jsonb(target_session);
exception
  when unique_violation then
    return query select 'open_session_exists'::text, null::jsonb;
end;
$$;

revoke all on function public.start_session_atomic(uuid, uuid, text, numeric, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.start_session_atomic(uuid, uuid, text, numeric, integer, timestamptz)
  to service_role;
