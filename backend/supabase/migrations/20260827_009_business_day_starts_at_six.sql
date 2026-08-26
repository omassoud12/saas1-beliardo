-- Convert a UTC timestamp to the calendar date of the tenant business day.
-- Subtracting from a timezone-local timestamp applies the 06:00 wall-clock
-- cutoff correctly even when daylight-saving offsets change.
drop function if exists public.business_date(timestamptz, text);

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

revoke all on function public.business_date(timestamptz, text, integer)
  from public, anon, authenticated;
grant execute on function public.business_date(timestamptz, text, integer)
  to service_role;

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
      -- UTC hour keys remain unique across daylight-saving fall-back hours.
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

revoke all on function public.get_business_analytics(uuid, timestamptz, timestamptz, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.get_business_analytics(uuid, timestamptz, timestamptz, text, text, integer)
  to service_role;
