-- Make one target per business/effective month a database invariant. Keep the
-- newest legacy duplicate, matching the pre-migration read behavior.

with ranked_targets as (
  select id, row_number() over (
    partition by business_id, date_trunc('month', effective_from::timestamp)
    order by created_at desc, id desc
  ) as duplicate_rank
  from public.business_targets
)
delete from public.business_targets bt
using ranked_targets ranked
where bt.id = ranked.id and ranked.duplicate_rank > 1;

create unique index if not exists business_targets_business_effective_key
  on public.business_targets (business_id, date_trunc('month', effective_from::timestamp));

create or replace function public.save_business_target_atomic(
  p_business_id uuid,
  p_actor_user_id uuid,
  p_target_id uuid,
  p_payload jsonb
) returns table (outcome text, record_data jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.business_targets%rowtype;
  resolved_target_id uuid := p_target_id;
  selected_currency text := upper(p_payload->>'currency');
  selected_rate numeric := (p_payload->>'exchangeRateToUsd')::numeric;
  revenue_target numeric := (p_payload->>'monthlyRevenueTarget')::numeric;
  profit_target numeric := (p_payload->>'monthlyProfitTarget')::numeric;
  cost_target numeric := nullif(p_payload->>'maximumMonthlyCosts', '')::numeric;
  effective_date date := (p_payload->>'effectiveFrom')::date;
  action_name text;
begin
  if not public.business_analysis_owner_authorized(p_business_id, p_actor_user_id) then
    return query select 'forbidden'::text, null::jsonb; return;
  end if;

  -- Serialize create-or-update decisions for the same tenant/month. The unique
  -- index remains the final guard if another write path bypasses this RPC.
  perform pg_advisory_xact_lock(hashtext(p_business_id::text || ':' || effective_date::text));

  if selected_currency = 'USD' then selected_rate := 1; end if;
  if resolved_target_id is null then
    select bt.id into resolved_target_id
    from public.business_targets bt
    where bt.business_id = p_business_id
      and date_trunc('month', bt.effective_from::timestamp) = date_trunc('month', effective_date::timestamp)
    limit 1
    for update;
  end if;

  if resolved_target_id is null then
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
      effective_date, p_actor_user_id
    ) returning * into saved;
    action_name := 'business_target.create';
  else
    update public.business_targets set
      monthly_revenue_target = revenue_target,
      monthly_profit_target = profit_target,
      minimum_profit_margin = (p_payload->>'minimumProfitMargin')::numeric,
      maximum_monthly_costs = cost_target,
      currency = selected_currency,
      exchange_rate_to_usd = selected_rate,
      monthly_revenue_target_usd = round(case when selected_currency = 'USD' then revenue_target else revenue_target / selected_rate end, 2),
      monthly_profit_target_usd = round(case when selected_currency = 'USD' then profit_target else profit_target / selected_rate end, 2),
      maximum_monthly_costs_usd = case when cost_target is null then null else round(case when selected_currency = 'USD' then cost_target else cost_target / selected_rate end, 2) end,
      effective_from = effective_date
    where id = resolved_target_id and business_id = p_business_id
    returning * into saved;
    if not found then return query select 'not_found'::text, null::jsonb; return; end if;
    action_name := 'business_target.update';
  end if;

  insert into public.admin_audit_logs (actor_user_id, business_id, action, metadata)
  values (p_actor_user_id, p_business_id, action_name, jsonb_build_object('target_id', saved.id));
  return query select 'saved'::text, to_jsonb(saved);
exception when unique_violation then
  return query select 'conflict'::text, null::jsonb;
end;
$$;

revoke all on function public.save_business_target_atomic(uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_business_target_atomic(uuid, uuid, uuid, jsonb)
  to service_role;
