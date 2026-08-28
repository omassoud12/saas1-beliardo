create table if not exists public.business_report_exports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  quota_month date not null,
  report_type text not null check (report_type in ('daily', 'monthly', 'yearly')),
  period_key text not null check (char_length(period_key) between 4 and 10),
  filename text not null check (char_length(filename) between 5 and 180),
  config jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  storage_path text,
  size_bytes bigint check (size_bytes > 0),
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint business_report_exports_quota_month_check
    check (quota_month = date_trunc('month', quota_month)::date),
  constraint business_report_exports_completed_check
    check (
      status <> 'completed'
      or (storage_path is not null and size_bytes is not null and completed_at is not null)
    )
);

create unique index if not exists business_report_exports_one_pending_idx
  on public.business_report_exports (business_id)
  where status = 'pending';
create unique index if not exists business_report_exports_storage_path_idx
  on public.business_report_exports (storage_path)
  where storage_path is not null;
create index if not exists business_report_exports_quota_idx
  on public.business_report_exports (business_id, quota_month, completed_at desc)
  where status = 'completed';
create index if not exists business_report_exports_recent_idx
  on public.business_report_exports (business_id, completed_at desc)
  where status = 'completed';

alter table public.business_report_exports enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-reports', 'business-reports', false, 10485760, array['application/pdf']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.reserve_business_report_export(
  p_business_id uuid,
  p_requested_by uuid,
  p_quota_month date,
  p_report_type text,
  p_period_key text,
  p_filename text,
  p_config jsonb
)
returns table (outcome text, export_id uuid, used_count integer, remaining_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_count integer;
  new_export_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_business_id::text));

  if not exists (
    select 1
    from public.profiles p
    join public.business_members bm on bm.user_id = p.id
    join public.businesses b on b.id = bm.business_id
    where p.id = p_requested_by
      and bm.business_id = p_business_id
      and p.account_status = 'approved'
      and not p.requires_password_setup
      and bm.status = 'active'
      and bm.role = 'owner'
      and b.status = 'approved'
  ) then
    return query select 'forbidden'::text, null::uuid, 0, 0;
    return;
  end if;

  update public.business_report_exports
  set status = 'failed', failure_code = 'STALE_RESERVATION'
  where business_id = p_business_id
    and status = 'pending'
    and created_at < now() - interval '15 minutes';

  select count(*)::integer into completed_count
  from public.business_report_exports
  where business_id = p_business_id
    and quota_month = p_quota_month
    and status = 'completed';

  if exists (
    select 1 from public.business_report_exports
    where business_id = p_business_id and status = 'pending'
  ) then
    return query select 'generation_in_progress'::text, null::uuid,
      completed_count, greatest(0, 6 - completed_count);
    return;
  end if;

  if completed_count >= 6 then
    return query select 'quota_exceeded'::text, null::uuid, completed_count, 0;
    return;
  end if;

  insert into public.business_report_exports (
    business_id, requested_by, quota_month, report_type, period_key, filename, config
  ) values (
    p_business_id, p_requested_by, p_quota_month, p_report_type, p_period_key, p_filename, p_config
  ) returning id into new_export_id;

  return query select 'reserved'::text, new_export_id,
    completed_count, greatest(0, 5 - completed_count);
end;
$$;

revoke all on function public.reserve_business_report_export(uuid, uuid, date, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.reserve_business_report_export(uuid, uuid, date, text, text, text, jsonb)
  to service_role;
