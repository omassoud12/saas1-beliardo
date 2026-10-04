-- Immutable, tenant-scoped historical daily summaries. These rows supplement
-- Business analytics without creating synthetic sessions.

create table if not exists public.business_historical_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  schema_version text not null check (schema_version = '1.0'),
  period_type text not null check (period_type = 'daily'),
  normalized_content_hash text not null check (normalized_content_hash ~ '^[0-9a-f]{64}$'),
  source_type text,
  source_reference text check (source_reference is null or char_length(source_reference) <= 200),
  coverage_start date not null,
  coverage_end date not null,
  coverage_mode text not null check (coverage_mode in ('complete', 'partial')),
  record_count integer not null check (record_count > 0),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  constraint business_historical_import_coverage_check check (coverage_end >= coverage_start),
  unique (business_id, normalized_content_hash),
  unique (id, business_id)
);

create table if not exists public.business_historical_daily (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  import_batch_id uuid not null,
  business_date date not null,
  original_revenue_amount numeric(18, 2) not null check (original_revenue_amount >= 0),
  original_revenue_currency text not null check (original_revenue_currency in ('USD', 'LBP')),
  revenue_exchange_rate numeric(18, 6) not null check (revenue_exchange_rate > 0),
  revenue_usd numeric(18, 2) not null check (revenue_usd >= 0),
  original_expense_amount numeric(18, 2) check (original_expense_amount >= 0),
  original_expense_currency text check (original_expense_currency in ('USD', 'LBP')),
  expense_exchange_rate numeric(18, 6) check (expense_exchange_rate > 0),
  expenses_usd numeric(18, 2) check (expenses_usd >= 0),
  completed_sessions integer check (completed_sessions >= 0),
  total_duration_seconds bigint check (total_duration_seconds >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  constraint business_historical_daily_expense_shape_check check (
    (original_expense_amount is null and original_expense_currency is null and expense_exchange_rate is null and expenses_usd is null)
    or
    (original_expense_amount is not null and original_expense_currency is not null and expense_exchange_rate is not null and expenses_usd is not null)
  ),
  unique (id, business_id),
  constraint business_historical_daily_import_fkey
    foreign key (import_batch_id, business_id)
    references public.business_historical_imports(id, business_id)
    on delete restrict
);

create unique index if not exists business_historical_daily_active_date_key
  on public.business_historical_daily (business_id, business_date)
  where status = 'active';
create index if not exists business_historical_daily_range_idx
  on public.business_historical_daily (business_id, business_date)
  where status = 'active';
create index if not exists business_historical_imports_list_idx
  on public.business_historical_imports (business_id, confirmed_at desc, id desc);

create table if not exists public.business_historical_activity (
  historical_daily_id uuid not null,
  business_id uuid not null,
  activity_type text not null check (activity_type in ('playstation', 'billiard', 'pingpong')),
  original_revenue_amount numeric(18, 2) not null check (original_revenue_amount >= 0),
  revenue_usd numeric(18, 2) not null check (revenue_usd >= 0),
  primary key (historical_daily_id, activity_type),
  constraint business_historical_activity_daily_fkey
    foreign key (historical_daily_id, business_id)
    references public.business_historical_daily(id, business_id)
    on delete restrict
);

create index if not exists business_historical_activity_tenant_idx
  on public.business_historical_activity (business_id, activity_type);

alter table public.business_historical_imports enable row level security;
alter table public.business_historical_daily enable row level security;
alter table public.business_historical_activity enable row level security;

revoke all on public.business_historical_imports, public.business_historical_daily,
  public.business_historical_activity from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.business_historical_imports, public.business_historical_daily,
  public.business_historical_activity from authenticated;
grant select on public.business_historical_imports, public.business_historical_daily,
  public.business_historical_activity to authenticated;

create policy business_historical_imports_owner_select
  on public.business_historical_imports for select to authenticated
  using (public.is_approved_owner(business_id));
create policy business_historical_daily_owner_select
  on public.business_historical_daily for select to authenticated
  using (public.is_approved_owner(business_id));
create policy business_historical_activity_owner_select
  on public.business_historical_activity for select to authenticated
  using (public.is_approved_owner(business_id));

create or replace function public.inspect_business_historical_import(
  p_business_id uuid,
  p_actor_user_id uuid,
  p_business_dates date[],
  p_content_hash text
) returns table (duplicate_file boolean, conflict_dates date[])
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.business_historical_imports i
      where i.business_id = p_business_id
        and i.normalized_content_hash = p_content_hash
    ),
    coalesce(array(
      select distinct conflict_date
      from (
        select h.business_date as conflict_date
        from public.business_historical_daily h
        where h.business_id = p_business_id
          and h.status = 'active'
          and h.business_date = any(p_business_dates)
        union
        select public.business_date(s.ended_at, b.timezone, 6) as conflict_date
        from public.sessions s
        join public.businesses b on b.id = s.business_id
        where s.business_id = p_business_id
          and s.status = 'completed'
          and public.business_date(s.ended_at, b.timezone, 6) = any(p_business_dates)
      ) conflicts
      order by conflict_date
    ), array[]::date[])
  where public.business_analysis_owner_authorized(p_business_id, p_actor_user_id);
$$;

create or replace function public.save_business_historical_import_atomic(
  p_business_id uuid,
  p_actor_user_id uuid,
  p_content_hash text,
  p_payload jsonb
) returns table (outcome text, record_data jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_import public.business_historical_imports%rowtype;
  saved_daily public.business_historical_daily%rowtype;
  item jsonb;
  activity jsonb;
  import_dates date[];
begin
  if not public.business_analysis_owner_authorized(p_business_id, p_actor_user_id) then
    return query select 'forbidden'::text, null::jsonb; return;
  end if;

  select array_agg((value->>'business_date')::date order by (value->>'business_date')::date)
  into import_dates from jsonb_array_elements(p_payload->'records');

  if exists (
    select 1 from public.business_historical_imports i
    where i.business_id = p_business_id
      and i.normalized_content_hash = p_content_hash
  ) then
    return query select 'already_imported'::text, null::jsonb; return;
  end if;

  if exists (
    select 1 from public.business_historical_daily h
    where h.business_id = p_business_id and h.status = 'active'
      and h.business_date = any(import_dates)
  ) or exists (
    select 1
    from public.sessions s
    join public.businesses b on b.id = s.business_id
    where s.business_id = p_business_id and s.status = 'completed'
      and public.business_date(s.ended_at, b.timezone, 6) = any(import_dates)
  ) then
    return query select 'conflict'::text, null::jsonb; return;
  end if;

  insert into public.business_historical_imports (
    business_id, schema_version, period_type, normalized_content_hash,
    source_type, source_reference, coverage_start, coverage_end, coverage_mode,
    record_count, created_by
  ) values (
    p_business_id, p_payload->>'schema_version', p_payload->>'period_type', p_content_hash,
    p_payload->'source'->>'type', nullif(p_payload->'source'->>'reference', ''),
    (p_payload->'coverage'->>'start_business_date')::date,
    (p_payload->'coverage'->>'end_business_date')::date,
    p_payload->'coverage'->>'mode', jsonb_array_length(p_payload->'records'), p_actor_user_id
  ) returning * into saved_import;

  for item in select value from jsonb_array_elements(p_payload->'records')
  loop
    insert into public.business_historical_daily (
      business_id, import_batch_id, business_date,
      original_revenue_amount, original_revenue_currency, revenue_exchange_rate, revenue_usd,
      original_expense_amount, original_expense_currency, expense_exchange_rate, expenses_usd,
      completed_sessions, total_duration_seconds, notes
    ) values (
      p_business_id, saved_import.id, (item->>'business_date')::date,
      (item->'revenue'->>'total')::numeric, item->'revenue'->>'currency',
      (item->'revenue'->>'exchange_rate_to_usd')::numeric, (item->'revenue'->>'usd')::numeric,
      nullif(item->'expenses'->>'total', '')::numeric, nullif(item->'expenses'->>'currency', ''),
      nullif(item->'expenses'->>'exchange_rate_to_usd', '')::numeric,
      nullif(item->'expenses'->>'usd', '')::numeric,
      nullif(item->'operations'->>'completed_sessions', '')::integer,
      nullif(item->'operations'->>'total_duration_seconds', '')::bigint,
      nullif(item->>'notes', '')
    ) returning * into saved_daily;

    for activity in select value from jsonb_array_elements(coalesce(item->'revenue'->'by_activity', '[]'::jsonb))
    loop
      insert into public.business_historical_activity (
        historical_daily_id, business_id, activity_type, original_revenue_amount, revenue_usd
      ) values (
        saved_daily.id, p_business_id, activity->>'activity_type',
        (activity->>'revenue')::numeric, (activity->>'usd')::numeric
      );
    end loop;
  end loop;

  insert into public.admin_audit_logs (actor_user_id, business_id, action, metadata)
  values (p_actor_user_id, p_business_id, 'business_historical_import.create',
    jsonb_build_object('import_id', saved_import.id, 'record_count', saved_import.record_count,
      'coverage_start', saved_import.coverage_start, 'coverage_end', saved_import.coverage_end));

  return query select 'saved'::text, to_jsonb(saved_import);
exception when unique_violation then
  return query select 'conflict'::text, null::jsonb;
end;
$$;

-- Historical data is deliberately absent from the hour bucket because a daily
-- ledger total cannot truthfully be assigned to a completion hour.
create or replace function public.get_business_historical_analytics(
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
  revenue numeric,
  row_kind text,
  operations_known boolean,
  duration_known boolean,
  activity_operations_known boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select h.*
    from public.business_historical_daily h
    where h.business_id = p_business_id
      and h.status = 'active'
      and h.business_date >= public.business_date(p_from, p_timezone, p_business_day_start_hour)
      and h.business_date < public.business_date(p_to, p_timezone, p_business_day_start_hour)
      and p_bucket in ('day', 'month')
  ), revenue_rows as (
    select
      case p_bucket when 'day' then h.business_date::text else to_char(h.business_date, 'YYYY-MM') end,
      a.activity_type,
      0::bigint,
      0::bigint,
      coalesce(a.revenue_usd, h.revenue_usd)::numeric,
      'revenue'::text,
      h.completed_sessions is not null,
      h.total_duration_seconds is not null,
      false
    from scoped h
    left join public.business_historical_activity a
      on a.historical_daily_id = h.id and a.business_id = h.business_id
  ), operation_rows as (
    select
      case p_bucket when 'day' then h.business_date::text else to_char(h.business_date, 'YYYY-MM') end,
      null::text,
      coalesce(h.completed_sessions, 0)::bigint,
      coalesce(h.total_duration_seconds, 0)::bigint,
      0::numeric,
      'operations'::text,
      h.completed_sessions is not null,
      h.total_duration_seconds is not null,
      false
    from scoped h
    where h.completed_sessions is not null or h.total_duration_seconds is not null
  )
  select * from revenue_rows
  union all
  select * from operation_rows
  order by 1, 2 nulls last, 6;
$$;

revoke all on function public.inspect_business_historical_import(uuid, uuid, date[], text),
  public.save_business_historical_import_atomic(uuid, uuid, text, jsonb),
  public.get_business_historical_analytics(uuid, timestamptz, timestamptz, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.inspect_business_historical_import(uuid, uuid, date[], text),
  public.save_business_historical_import_atomic(uuid, uuid, text, jsonb),
  public.get_business_historical_analytics(uuid, timestamptz, timestamptz, text, text, integer)
  to service_role;
