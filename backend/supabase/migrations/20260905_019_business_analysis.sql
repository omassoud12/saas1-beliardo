-- Additive phase-one Business Analysis storage. Revenue remains sourced only
-- from completed sessions; these tables hold owner-managed costs and targets.

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  category text not null check (category in ('RENT', 'ELECTRICITY', 'EMPLOYEES', 'OTHER')),
  amount numeric(18, 2) not null check (amount > 0),
  currency text not null check (currency in ('USD', 'LBP')),
  exchange_rate_to_usd numeric(18, 6) not null check (exchange_rate_to_usd > 0),
  amount_usd numeric(18, 2) not null check (amount_usd > 0),
  recurrence text not null check (recurrence in ('one_time', 'weekly', 'monthly', 'yearly')),
  occurrence_date date,
  start_date date not null,
  end_date date,
  include_in_profit boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_expenses_dates_check check (end_date is null or end_date >= start_date),
  constraint business_expenses_occurrence_check check (
    (recurrence = 'one_time' and occurrence_date is not null and start_date = occurrence_date)
    or (recurrence <> 'one_time' and occurrence_date is null)
  ),
  constraint business_expenses_usd_rate_check check (currency <> 'USD' or exchange_rate_to_usd = 1)
);

create table if not exists public.business_targets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  monthly_revenue_target numeric(18, 2) not null check (monthly_revenue_target > 0),
  monthly_profit_target numeric(18, 2) not null check (monthly_profit_target > 0),
  minimum_profit_margin numeric(8, 2) not null check (minimum_profit_margin between 0 and 100),
  maximum_monthly_costs numeric(18, 2) check (maximum_monthly_costs > 0),
  currency text not null check (currency in ('USD', 'LBP')),
  exchange_rate_to_usd numeric(18, 6) not null check (exchange_rate_to_usd > 0),
  monthly_revenue_target_usd numeric(18, 2) not null check (monthly_revenue_target_usd > 0),
  monthly_profit_target_usd numeric(18, 2) not null check (monthly_profit_target_usd > 0),
  maximum_monthly_costs_usd numeric(18, 2) check (maximum_monthly_costs_usd > 0),
  effective_from date not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_targets_usd_rate_check check (currency <> 'USD' or exchange_rate_to_usd = 1)
);

create index if not exists business_expenses_tenant_dates_idx
  on public.business_expenses (business_id, start_date, end_date);
create index if not exists business_expenses_tenant_occurrence_idx
  on public.business_expenses (business_id, occurrence_date)
  where recurrence = 'one_time';
create index if not exists business_targets_tenant_effective_idx
  on public.business_targets (business_id, effective_from desc, created_at desc);

drop trigger if exists business_expenses_set_updated_at on public.business_expenses;
create trigger business_expenses_set_updated_at before update on public.business_expenses
for each row execute function public.set_updated_at();
drop trigger if exists business_targets_set_updated_at on public.business_targets;
create trigger business_targets_set_updated_at before update on public.business_targets
for each row execute function public.set_updated_at();

alter table public.business_expenses enable row level security;
alter table public.business_targets enable row level security;

revoke all on public.business_expenses, public.business_targets from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.business_expenses, public.business_targets from authenticated;
grant select on public.business_expenses, public.business_targets to authenticated;

drop policy if exists business_expenses_owner_select on public.business_expenses;
create policy business_expenses_owner_select on public.business_expenses for select to authenticated
using (public.is_approved_owner(business_id));
drop policy if exists business_expenses_owner_insert on public.business_expenses;
create policy business_expenses_owner_insert on public.business_expenses for insert to authenticated
with check (public.is_approved_owner(business_id) and created_by = auth.uid());
drop policy if exists business_expenses_owner_update on public.business_expenses;
create policy business_expenses_owner_update on public.business_expenses for update to authenticated
using (public.is_approved_owner(business_id))
with check (public.is_approved_owner(business_id) and created_by = auth.uid());
drop policy if exists business_expenses_owner_delete on public.business_expenses;
create policy business_expenses_owner_delete on public.business_expenses for delete to authenticated
using (public.is_approved_owner(business_id));

drop policy if exists business_targets_owner_select on public.business_targets;
create policy business_targets_owner_select on public.business_targets for select to authenticated
using (public.is_approved_owner(business_id));
drop policy if exists business_targets_owner_insert on public.business_targets;
create policy business_targets_owner_insert on public.business_targets for insert to authenticated
with check (public.is_approved_owner(business_id) and created_by = auth.uid());
drop policy if exists business_targets_owner_update on public.business_targets;
create policy business_targets_owner_update on public.business_targets for update to authenticated
using (public.is_approved_owner(business_id))
with check (public.is_approved_owner(business_id) and created_by = auth.uid());
drop policy if exists business_targets_owner_delete on public.business_targets;
create policy business_targets_owner_delete on public.business_targets for delete to authenticated
using (public.is_approved_owner(business_id));

create or replace function public.business_analysis_owner_authorized(
  p_business_id uuid,
  p_actor_user_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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
  );
$$;

revoke all on function public.business_analysis_owner_authorized(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.business_analysis_owner_authorized(uuid, uuid) to service_role;

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
  selected_currency text := upper(p_payload->>'currency');
  selected_rate numeric := (p_payload->>'exchangeRateToUsd')::numeric;
  selected_amount numeric := (p_payload->>'amount')::numeric;
  selected_recurrence text := lower(p_payload->>'recurrence');
  selected_occurrence date := nullif(p_payload->>'occurrenceDate', '')::date;
  selected_start date := (p_payload->>'startDate')::date;
  selected_end date := nullif(p_payload->>'endDate', '')::date;
begin
  if not public.business_analysis_owner_authorized(p_business_id, p_actor_user_id) then
    return query select 'forbidden'::text, null::jsonb; return;
  end if;

  if selected_currency = 'USD' then selected_rate := 1; end if;
  if p_expense_id is null then
    insert into public.business_expenses (
      business_id, name, category, amount, currency, exchange_rate_to_usd, amount_usd,
      recurrence, occurrence_date, start_date, end_date, include_in_profit, notes, created_by
    ) values (
      p_business_id, trim(p_payload->>'name'), upper(p_payload->>'category'), selected_amount,
      selected_currency, selected_rate,
      round(case when selected_currency = 'USD' then selected_amount else selected_amount / selected_rate end, 2),
      selected_recurrence, selected_occurrence, selected_start, selected_end,
      coalesce((p_payload->>'includeInProfit')::boolean, true), nullif(trim(p_payload->>'notes'), ''), p_actor_user_id
    ) returning * into saved;
  else
    update public.business_expenses set
      name = trim(p_payload->>'name'), category = upper(p_payload->>'category'), amount = selected_amount,
      currency = selected_currency, exchange_rate_to_usd = selected_rate,
      amount_usd = round(case when selected_currency = 'USD' then selected_amount else selected_amount / selected_rate end, 2),
      recurrence = selected_recurrence, occurrence_date = selected_occurrence, start_date = selected_start,
      end_date = selected_end, include_in_profit = coalesce((p_payload->>'includeInProfit')::boolean, true),
      notes = nullif(trim(p_payload->>'notes'), '')
    where id = p_expense_id and business_id = p_business_id
    returning * into saved;
    if not found then return query select 'not_found'::text, null::jsonb; return; end if;
  end if;

  insert into public.admin_audit_logs (actor_user_id, business_id, action, metadata)
  values (p_actor_user_id, p_business_id,
    case when p_expense_id is null then 'business_expense.create' else 'business_expense.update' end,
    jsonb_build_object('expense_id', saved.id));
  return query select 'saved'::text, to_jsonb(saved);
exception when unique_violation then
  return query select 'conflict'::text, null::jsonb;
end;
$$;

create or replace function public.delete_business_expense_atomic(
  p_business_id uuid,
  p_actor_user_id uuid,
  p_expense_id uuid
) returns table (outcome text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.business_analysis_owner_authorized(p_business_id, p_actor_user_id) then
    return query select 'forbidden'::text; return;
  end if;
  delete from public.business_expenses where id = p_expense_id and business_id = p_business_id;
  if not found then return query select 'not_found'::text; return; end if;
  insert into public.admin_audit_logs (actor_user_id, business_id, action, metadata)
  values (p_actor_user_id, p_business_id, 'business_expense.delete', jsonb_build_object('expense_id', p_expense_id));
  return query select 'deleted'::text;
end;
$$;

create or replace function public.create_business_target_atomic(
  p_business_id uuid,
  p_actor_user_id uuid,
  p_payload jsonb
) returns table (outcome text, record_data jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.business_targets%rowtype;
  selected_currency text := upper(p_payload->>'currency');
  selected_rate numeric := (p_payload->>'exchangeRateToUsd')::numeric;
  revenue_target numeric := (p_payload->>'monthlyRevenueTarget')::numeric;
  profit_target numeric := (p_payload->>'monthlyProfitTarget')::numeric;
  cost_target numeric := nullif(p_payload->>'maximumMonthlyCosts', '')::numeric;
begin
  if not public.business_analysis_owner_authorized(p_business_id, p_actor_user_id) then
    return query select 'forbidden'::text, null::jsonb; return;
  end if;
  if selected_currency = 'USD' then selected_rate := 1; end if;
  insert into public.business_targets (
    business_id, monthly_revenue_target, monthly_profit_target, minimum_profit_margin,
    maximum_monthly_costs, currency, exchange_rate_to_usd, monthly_revenue_target_usd,
    monthly_profit_target_usd, maximum_monthly_costs_usd, effective_from, created_by
  ) values (
    p_business_id, revenue_target, profit_target, (p_payload->>'minimumProfitMargin')::numeric,
    cost_target, selected_currency, selected_rate,
    round(case when selected_currency = 'USD' then revenue_target else revenue_target / selected_rate end, 2),
    round(case when selected_currency = 'USD' then profit_target else profit_target / selected_rate end, 2),
    case when cost_target is null then null else round(case when selected_currency = 'USD' then cost_target else cost_target / selected_rate end, 2) end,
    (p_payload->>'effectiveFrom')::date, p_actor_user_id
  ) returning * into saved;
  insert into public.admin_audit_logs (actor_user_id, business_id, action, metadata)
  values (p_actor_user_id, p_business_id, 'business_target.create', jsonb_build_object('target_id', saved.id));
  return query select 'created'::text, to_jsonb(saved);
end;
$$;

revoke all on function public.save_business_expense_atomic(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.delete_business_expense_atomic(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.create_business_target_atomic(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_business_expense_atomic(uuid, uuid, uuid, jsonb),
  public.delete_business_expense_atomic(uuid, uuid, uuid),
  public.create_business_target_atomic(uuid, uuid, jsonb)
  to service_role;

comment on column public.business_expenses.exchange_rate_to_usd is
  'Transaction-time units of the record currency per USD; USD records use 1.';
comment on column public.business_targets.exchange_rate_to_usd is
  'Target-time units of the record currency per USD; USD records use 1.';
