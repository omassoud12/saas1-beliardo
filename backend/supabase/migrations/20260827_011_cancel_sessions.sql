alter table public.sessions
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete restrict;

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions
  add constraint sessions_status_check
  check (status in ('draft', 'active', 'paused', 'completed', 'cancelled'));

create or replace function public.cancel_session(
  p_business_id uuid,
  p_session_id uuid,
  p_cancelled_by uuid
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
    where p.id = p_cancelled_by
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
  into target_session
  from public.sessions s
  where s.id = p_session_id
    and s.business_id = p_business_id
  for update;

  if not found then
    return query select 'not_found'::text, null::jsonb;
    return;
  end if;

  if target_session.status not in ('active', 'paused') then
    return query select 'invalid_state'::text, to_jsonb(target_session);
    return;
  end if;

  update public.sessions
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_cancelled_by,
      paused_at = null,
      total_paused_seconds = 0,
      ended_at = null,
      final_elapsed_seconds = null,
      final_cost = null
  where id = target_session.id
    and business_id = p_business_id
  returning * into target_session;

  update public.stations
  set status = 'available',
      session_start_at = null,
      paused_at = null,
      total_paused_ms = 0,
      planned_start_at = null
  where id = target_session.station_id
    and business_id = p_business_id;

  if not found then
    raise exception 'Session station was not found';
  end if;

  return query select 'cancelled'::text, to_jsonb(target_session);
end;
$$;

revoke all on function public.cancel_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_session(uuid, uuid, uuid) to service_role;
