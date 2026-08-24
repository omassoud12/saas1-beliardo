create index if not exists sessions_business_started_idx
  on public.sessions (business_id, started_at)
  where started_at is not null;

create or replace function public.get_business_analytics(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text,
  p_timezone text
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
      when 'hour' then to_char(date_trunc('hour', s.started_at at time zone p_timezone), 'YYYY-MM-DD"T"HH24:00')
      when 'day' then to_char(date_trunc('day', s.ended_at at time zone p_timezone), 'YYYY-MM-DD')
      else to_char(date_trunc('month', s.ended_at at time zone p_timezone), 'YYYY-MM')
    end as bucket_key,
    st.type as activity_type,
    count(*)::bigint as session_count,
    coalesce(sum(s.final_elapsed_seconds), 0)::bigint as total_seconds,
    coalesce(sum(s.final_cost), 0)::numeric as revenue
  from public.sessions s
  join public.stations st
    on st.id = s.station_id and st.business_id = s.business_id
  where s.business_id = p_business_id
    and s.status = 'completed'
    and s.ended_at >= p_from
    and s.ended_at < p_to
  group by 1, st.type
  order by 1, st.type;
end;
$$;

revoke all on function public.get_business_analytics(uuid, timestamptz, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.get_business_analytics(uuid, timestamptz, timestamptz, text, text)
  to service_role;
