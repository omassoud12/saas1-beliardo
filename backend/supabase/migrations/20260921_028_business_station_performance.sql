-- Aggregate station performance in PostgreSQL so the API transfers one row per
-- station instead of every completed session in the selected tenant/range.

create or replace function public.get_business_station_performance(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  activity_type text,
  station_number integer,
  session_count bigint,
  total_seconds bigint,
  revenue numeric,
  legacy_fallback_sessions bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select
      coalesce(s.station_type_at_completion, st.type) as activity_type,
      coalesce(s.station_number_at_completion, st.number) as station_number,
      s.final_elapsed_seconds,
      s.final_cost,
      (s.station_type_at_completion is null or s.station_number_at_completion is null) as used_legacy_fallback
    from public.sessions s
    left join public.stations st
      on st.id = s.station_id and st.business_id = s.business_id
    where s.business_id = p_business_id
      and s.status = 'completed'
      and s.ended_at >= p_from
      and s.ended_at < p_to
  )
  select
    scoped.activity_type,
    scoped.station_number,
    count(*)::bigint,
    coalesce(sum(scoped.final_elapsed_seconds), 0)::bigint,
    coalesce(sum(scoped.final_cost), 0)::numeric,
    coalesce(sum(count(*) filter (where scoped.used_legacy_fallback)) over (), 0)::bigint
  from scoped
  group by scoped.activity_type, scoped.station_number
  order by coalesce(sum(scoped.final_cost), 0) desc, scoped.activity_type, scoped.station_number;
$$;

revoke all on function public.get_business_station_performance(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_business_station_performance(uuid, timestamptz, timestamptz)
  to service_role;
