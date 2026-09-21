-- Preserve expense definitions as effective-dated versions. Reports can now
-- reproduce the cost definition that was active for the requested date.

alter table public.business_expenses
  add column if not exists valid_from date,
  add column if not exists valid_to date,
  add column if not exists supersedes_expense_id uuid
    references public.business_expenses(id) on delete restrict;

update public.business_expenses
set valid_from = start_date
where valid_from is null;

alter table public.business_expenses
  alter column valid_from set not null;

create index if not exists business_expenses_tenant_validity_idx
  on public.business_expenses (business_id, valid_from, valid_to);
create index if not exists business_expenses_supersedes_idx
  on public.business_expenses (supersedes_expense_id)
  where supersedes_expense_id is not null;

create or replace function public.save_business_expense_atomic(
  p_business_id uuid,
  p_actor_user_id uuid,
  p_expense_id uuid,
  p_payload jsonb
) returns table (outcome text, record_data jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.business_expenses%rowtype;
  previous public.business_expenses%rowtype;
  selected_currency text := upper(p_payload->>'currency');
  selected_rate numeric := (p_payload->>'exchangeRateToUsd')::numeric;
  selected_amount numeric := (p_payload->>'amount')::numeric;
  selected_recurrence text := lower(p_payload->>'recurrence');
  selected_occurrence date := nullif(p_payload->>'occurrenceDate', '')::date;
  selected_start date := (p_payload->>'startDate')::date;
  selected_end date := nullif(p_payload->>'endDate', '')::date;
  selected_effective date := coalesce(nullif(p_payload->>'effectiveDate', '')::date, current_date);
  version_boundary date;
begin
  if not public.business_analysis_owner_authorized(p_business_id, p_actor_user_id) then
    return query select 'forbidden'::text, null::jsonb; return;
  end if;

  if selected_currency = 'USD' then selected_rate := 1; end if;

  if p_expense_id is not null then
    select * into previous
    from public.business_expenses
    where id = p_expense_id
      and business_id = p_business_id
      and valid_to is null
    for update;
    if not found then return query select 'not_found'::text, null::jsonb; return; end if;

    version_boundary := greatest(selected_effective, previous.valid_from);
    update public.business_expenses
    set valid_to = version_boundary
    where id = previous.id;
  end if;

  insert into public.business_expenses (
    business_id, name, category, amount, currency, exchange_rate_to_usd, amount_usd,
    recurrence, occurrence_date, start_date, end_date, include_in_profit, notes,
    created_by, valid_from, supersedes_expense_id
  ) values (
    p_business_id, trim(p_payload->>'name'), upper(p_payload->>'category'), selected_amount,
    selected_currency, selected_rate,
    round(case when selected_currency = 'USD' then selected_amount else selected_amount / selected_rate end, 2),
    selected_recurrence, selected_occurrence, selected_start, selected_end,
    coalesce((p_payload->>'includeInProfit')::boolean, true), nullif(trim(p_payload->>'notes'), ''),
    p_actor_user_id, coalesce(version_boundary, selected_effective), previous.id
  ) returning * into saved;

  insert into public.admin_audit_logs (actor_user_id, business_id, action, metadata)
  values (
    p_actor_user_id,
    p_business_id,
    case when p_expense_id is null then 'business_expense.create' else 'business_expense.update' end,
    jsonb_build_object('expense_id', saved.id, 'previous_expense_id', previous.id,
      'effective_date', saved.valid_from)
  );
  return query select 'saved'::text, to_jsonb(saved);
exception when unique_violation then
  return query select 'conflict'::text, null::jsonb;
end;
$$;

drop function if exists public.delete_business_expense_atomic(uuid, uuid, uuid);

create function public.delete_business_expense_atomic(
  p_business_id uuid,
  p_actor_user_id uuid,
  p_expense_id uuid,
  p_effective_date date
) returns table (outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_version public.business_expenses%rowtype;
  version_boundary date;
begin
  if not public.business_analysis_owner_authorized(p_business_id, p_actor_user_id) then
    return query select 'forbidden'::text; return;
  end if;

  select * into current_version
  from public.business_expenses
  where id = p_expense_id
    and business_id = p_business_id
    and valid_to is null
  for update;
  if not found then return query select 'not_found'::text; return; end if;

  version_boundary := greatest(p_effective_date, current_version.valid_from);
  update public.business_expenses
  set valid_to = version_boundary
  where id = current_version.id;

  insert into public.admin_audit_logs (actor_user_id, business_id, action, metadata)
  values (p_actor_user_id, p_business_id, 'business_expense.delete',
    jsonb_build_object('expense_id', p_expense_id, 'effective_date', version_boundary));
  return query select 'deleted'::text;
end;
$$;

revoke all on function public.save_business_expense_atomic(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.delete_business_expense_atomic(uuid, uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function public.save_business_expense_atomic(uuid, uuid, uuid, jsonb),
  public.delete_business_expense_atomic(uuid, uuid, uuid, date)
  to service_role;

comment on column public.business_expenses.valid_from is
  'Business-local date on which this immutable expense version becomes active.';
comment on column public.business_expenses.valid_to is
  'Exclusive business-local date on which this expense version stops being active.';
