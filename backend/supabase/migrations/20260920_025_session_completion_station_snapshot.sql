alter table public.sessions
  add column if not exists station_type_at_completion text
    check (station_type_at_completion is null or station_type_at_completion in ('billiard', 'pingpong', 'playstation')),
  add column if not exists station_number_at_completion integer
    check (station_number_at_completion is null or station_number_at_completion between 1 and 999);

-- Existing completed sessions cannot recover a station's former configuration.
-- Freeze the current related values now; runtime queries still use COALESCE as a
-- compatibility fallback for any row that remains without a snapshot.
update public.sessions s
set station_type_at_completion = coalesce(s.station_type_at_completion, st.type),
    station_number_at_completion = coalesce(s.station_number_at_completion, st.number)
from public.stations st
where s.station_id = st.id
  and s.business_id = st.business_id
  and s.status = 'completed'
  and (s.station_type_at_completion is null or s.station_number_at_completion is null);

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
    coalesce(s.station_type_at_completion, st.type) as activity_type,
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
  group by 1, coalesce(s.station_type_at_completion, st.type)
  order by 1, coalesce(s.station_type_at_completion, st.type);
end;
$$;

revoke all on function public.get_business_analytics(uuid, timestamptz, timestamptz, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.get_business_analytics(uuid, timestamptz, timestamptz, text, text, integer)
  to service_role;

create or replace function public.end_session(
  p_business_id uuid,
  p_session_id uuid,
  p_ended_by uuid,
  p_ended_at timestamptz,
  p_expected_updated_at timestamptz,
  p_total_paused_seconds integer,
  p_final_elapsed_seconds integer,
  p_final_cost numeric,
  p_pause_intervals jsonb
)
returns table (outcome text, session_record jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.sessions%rowtype;
  completion_station public.stations%rowtype;
begin
  if not exists (
    select 1
    from public.profiles p
    join public.business_members bm on bm.user_id = p.id
    join public.businesses b on b.id = bm.business_id
    where p.id = p_ended_by
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

  select s.* into target_session
  from public.sessions s
  where s.id = p_session_id and s.business_id = p_business_id
  for update;

  if not found then
    return query select 'not_found'::text, null::jsonb;
    return;
  end if;
  if target_session.status not in ('active', 'paused') then
    return query select 'invalid_state'::text, to_jsonb(target_session);
    return;
  end if;
  if target_session.updated_at is distinct from p_expected_updated_at then
    return query select 'conflict'::text, to_jsonb(target_session);
    return;
  end if;
  if p_ended_at < target_session.started_at or p_ended_at > now()
     or p_total_paused_seconds < 0 or p_final_elapsed_seconds < 0 or p_final_cost < 0
     or jsonb_typeof(p_pause_intervals) <> 'array' then
    return query select 'invalid_values'::text, to_jsonb(target_session);
    return;
  end if;

  select st.* into completion_station
  from public.stations st
  where st.id = target_session.station_id and st.business_id = p_business_id
  for update;
  if not found then raise exception 'Session station was not found'; end if;

  update public.sessions
  set status = 'completed', ended_at = p_ended_at, ended_recorded_at = now(), ended_by = p_ended_by,
      paused_at = null, total_paused_seconds = p_total_paused_seconds,
      final_elapsed_seconds = p_final_elapsed_seconds, final_cost = p_final_cost,
      pause_intervals = p_pause_intervals,
      station_type_at_completion = completion_station.type,
      station_number_at_completion = completion_station.number
  where id = target_session.id and business_id = p_business_id
  returning * into target_session;

  update public.stations
  set status = 'available', session_start_at = null, paused_at = null,
      total_paused_ms = 0, planned_start_at = null
  where id = target_session.station_id and business_id = p_business_id;
  if not found then raise exception 'Session station was not found'; end if;

  return query select 'completed'::text, to_jsonb(target_session);
end;
$$;

revoke all on function public.end_session(uuid, uuid, uuid, timestamptz, timestamptz, integer, integer, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.end_session(uuid, uuid, uuid, timestamptz, timestamptz, integer, integer, numeric, jsonb)
  to service_role;
