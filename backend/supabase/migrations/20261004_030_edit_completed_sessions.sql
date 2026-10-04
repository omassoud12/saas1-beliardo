-- Correct billed duration and revenue without changing the original event timeline.
create or replace function public.edit_completed_session_atomic(
  p_business_id uuid, p_session_id uuid, p_actor_user_id uuid,
  p_duration_seconds bigint, p_final_cost numeric, p_expected_updated_at timestamptz
) returns table (outcome text, session_record jsonb)
language plpgsql security definer set search_path = public
as $$
declare
  target public.sessions%rowtype;
  previous_values jsonb;
begin
  if not exists (
    select 1 from public.profiles p
    join public.business_members bm on bm.user_id = p.id
    join public.businesses b on b.id = bm.business_id
    where p.id = p_actor_user_id and bm.business_id = p_business_id
      and p.account_status = 'approved' and not p.requires_password_setup
      and bm.status = 'active' and bm.role in ('owner', 'employee')
      and b.status = 'approved'
  ) then return query select 'forbidden'::text, null::jsonb; return; end if;
  select * into target from public.sessions
    where id = p_session_id and business_id = p_business_id for update;
  if not found then return query select 'not_found'::text, null::jsonb; return; end if;
  if target.status <> 'completed' then return query select 'invalid_transition'::text, null::jsonb; return; end if;
  if p_expected_updated_at is null or target.updated_at is distinct from p_expected_updated_at then
    return query select 'stale'::text, null::jsonb; return;
  end if;
  if p_duration_seconds is null or p_duration_seconds < 0 or p_duration_seconds > 31536000
    or p_final_cost is null or p_final_cost < 0 or p_final_cost > 9999999999.99
    or p_final_cost <> round(p_final_cost, 2) then
    return query select 'invalid_values'::text, null::jsonb; return;
  end if;
  previous_values := jsonb_build_object('duration_seconds', target.final_elapsed_seconds, 'final_cost', target.final_cost);
  update public.sessions set final_elapsed_seconds = p_duration_seconds,
    final_cost = p_final_cost, updated_at = clock_timestamp()
    where id = p_session_id and business_id = p_business_id returning * into target;
  insert into public.admin_audit_logs(actor_user_id, business_id, action, metadata)
  values(p_actor_user_id, p_business_id, 'session.correct_completed', jsonb_build_object(
    'session_id', p_session_id, 'before', previous_values,
    'after', jsonb_build_object('duration_seconds', target.final_elapsed_seconds, 'final_cost', target.final_cost)));
  return query select 'updated'::text, to_jsonb(target);
end;
$$;
revoke all on function public.edit_completed_session_atomic(uuid, uuid, uuid, bigint, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.edit_completed_session_atomic(uuid, uuid, uuid, bigint, numeric, timestamptz) to service_role;
