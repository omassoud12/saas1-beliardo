alter table public.sessions
  add column if not exists pause_intervals jsonb not null default '[]'::jsonb,
  add column if not exists ended_recorded_at timestamptz,
  add column if not exists ended_by uuid references auth.users(id) on delete restrict;

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

  update public.sessions
  set status = 'completed', ended_at = p_ended_at, ended_recorded_at = now(), ended_by = p_ended_by,
      paused_at = null, total_paused_seconds = p_total_paused_seconds,
      final_elapsed_seconds = p_final_elapsed_seconds, final_cost = p_final_cost,
      pause_intervals = p_pause_intervals
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
