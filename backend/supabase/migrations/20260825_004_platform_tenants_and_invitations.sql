create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  full_name text,
  account_type text not null default 'owner'
    check (account_type in ('platform_admin', 'owner', 'employee')),
  account_status text not null default 'pending_email'
    check (account_status in ('pending_email', 'pending_approval', 'approved', 'rejected', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete restrict
);

alter table public.businesses add column if not exists status text not null default 'approved';
alter table public.businesses drop constraint if exists businesses_status_check;
alter table public.businesses add constraint businesses_status_check
  check (status in ('pending_approval', 'approved', 'rejected', 'suspended', 'deleted'));

alter table public.business_members add column if not exists status text not null default 'active';
alter table public.business_members add column if not exists updated_at timestamptz not null default now();
alter table public.business_members drop constraint if exists business_members_status_check;
alter table public.business_members add constraint business_members_status_check
  check (status in ('active', 'disabled', 'removed'));

update public.business_members set role = 'owner' where role = 'admin';
update public.business_members set role = 'employee' where role = 'manager';
alter table public.business_members drop constraint if exists business_members_role_check;
alter table public.business_members add constraint business_members_role_check
  check (role in ('owner', 'employee'));

create table if not exists public.employee_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  role text not null default 'employee' check (role = 'employee'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employee_invitations_one_pending_idx
  on public.employee_invitations (business_id, lower(email))
  where status = 'pending';
create index if not exists employee_invitations_business_status_idx
  on public.employee_invitations (business_id, status, created_at desc);

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs (actor_user_id, created_at desc);
create index if not exists admin_audit_logs_business_idx on public.admin_audit_logs (business_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists business_members_set_updated_at on public.business_members;
create trigger business_members_set_updated_at before update on public.business_members
for each row execute function public.set_updated_at();
drop trigger if exists employee_invitations_set_updated_at on public.employee_invitations;
create trigger employee_invitations_set_updated_at before update on public.employee_invitations
for each row execute function public.set_updated_at();

-- Preserve existing accounts as approved while moving them into the new model.
insert into public.profiles (id, email, full_name, account_type, account_status)
select
  u.id,
  lower(u.email),
  nullif(u.raw_user_meta_data ->> 'full_name', ''),
  case when exists (
    select 1 from public.business_members bm where bm.user_id = u.id and bm.role = 'employee'
  ) then 'employee' else 'owner' end,
  'approved'
from auth.users u
on conflict (id) do nothing;

create or replace function public.provision_confirmed_owner(
  target_user_id uuid,
  business_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
begin
  select bm.business_id into new_business_id
  from public.business_members bm
  where bm.user_id = target_user_id and bm.role = 'owner'
  limit 1;

  if new_business_id is null then
    insert into public.businesses (name, created_by, status)
    values (coalesce(nullif(trim(business_name), ''), 'My Lounge'), target_user_id, 'pending_approval')
    returning id into new_business_id;

    insert into public.business_members (business_id, user_id, role, status)
    values (new_business_id, target_user_id, 'owner', 'active');
  end if;

  update public.profiles
  set account_status = 'pending_approval', account_type = 'owner'
  where id = target_user_id and account_status = 'pending_email';
  return new_business_id;
end;
$$;

create or replace function public.handle_saas_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  registration_type text;
begin
  registration_type := case
    when new.raw_user_meta_data ->> 'registration_type' = 'employee' then 'employee'
    else 'owner'
  end;

  insert into public.profiles (id, email, full_name, account_type, account_status)
  values (
    new.id,
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    registration_type,
    'pending_email'
  )
  on conflict (id) do nothing;

  if new.email_confirmed_at is not null and registration_type = 'owner' then
    perform public.provision_confirmed_owner(new.id, new.raw_user_meta_data ->> 'business_name');
  end if;
  return new;
end;
$$;

create or replace function public.handle_saas_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null
    and exists (select 1 from public.profiles p where p.id = new.id and p.account_type = 'owner') then
    perform public.provision_confirmed_owner(new.id, new.raw_user_meta_data ->> 'business_name');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_business on auth.users;
drop trigger if exists on_auth_user_created_saas_profile on auth.users;
create trigger on_auth_user_created_saas_profile
after insert on auth.users for each row execute function public.handle_saas_user_created();
drop trigger if exists on_auth_user_email_confirmed_saas on auth.users;
create trigger on_auth_user_email_confirmed_saas
after update of email_confirmed_at on auth.users
for each row execute function public.handle_saas_email_confirmed();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    join public.profiles p on p.id = pa.user_id
    where pa.user_id = auth.uid() and p.account_status = 'approved'
  );
$$;

create or replace function public.has_active_tenant_membership(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    join public.profiles p on p.id = bm.user_id
    join public.businesses b on b.id = bm.business_id
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.status = 'active'
      and p.account_status = 'approved'
      and b.status = 'approved'
  );
$$;

create or replace function public.has_tenant_role(target_business_id uuid, target_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_active_tenant_membership(target_business_id)
    and exists (
      select 1 from public.business_members bm
      where bm.business_id = target_business_id
        and bm.user_id = auth.uid()
        and bm.role = target_role
    );
$$;

create or replace function public.is_approved_owner(target_business_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_tenant_role(target_business_id, 'owner'); $$;

create or replace function public.is_active_employee(target_business_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_tenant_role(target_business_id, 'employee'); $$;

revoke all on function public.provision_confirmed_owner(uuid, text) from public, anon, authenticated;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.has_active_tenant_membership(uuid) from public, anon;
revoke all on function public.has_tenant_role(uuid, text) from public, anon;
revoke all on function public.is_approved_owner(uuid) from public, anon;
revoke all on function public.is_active_employee(uuid) from public, anon;
grant execute on function public.is_platform_admin(), public.has_active_tenant_membership(uuid),
  public.has_tenant_role(uuid, text), public.is_approved_owner(uuid), public.is_active_employee(uuid)
  to authenticated;

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.employee_invitations enable row level security;
alter table public.admin_audit_logs enable row level security;

-- The application writes through the validated backend only. Remove the broad
-- member-write policies created by the original single-role schema.
drop policy if exists businesses_member_update on public.businesses;
drop policy if exists stations_member_all on public.stations;
drop policy if exists sessions_member_all on public.sessions;
revoke insert, update, delete, truncate, references, trigger
  on public.businesses, public.business_members, public.stations, public.sessions
  from authenticated;
grant select on public.businesses, public.business_members, public.stations, public.sessions
  to authenticated;

revoke all on public.profiles, public.platform_admins, public.employee_invitations, public.admin_audit_logs from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.profiles, public.platform_admins, public.employee_invitations, public.admin_audit_logs
  from authenticated;
grant select on public.profiles, public.platform_admins, public.employee_invitations, public.admin_audit_logs
  to authenticated;

drop policy if exists profiles_authorized_select on public.profiles;
create policy profiles_authorized_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_platform_admin());
drop policy if exists platform_admins_admin_select on public.platform_admins;
create policy platform_admins_admin_select on public.platform_admins for select to authenticated
using (public.is_platform_admin());
drop policy if exists businesses_member_select on public.businesses;
create policy businesses_member_select on public.businesses for select to authenticated
using (public.is_platform_admin() or public.has_active_tenant_membership(id));
drop policy if exists business_members_member_select on public.business_members;
create policy business_members_member_select on public.business_members for select to authenticated
using (
  public.is_platform_admin()
  or user_id = auth.uid()
  or public.is_approved_owner(business_id)
);
drop policy if exists stations_member_select on public.stations;
create policy stations_member_select on public.stations for select to authenticated
using (
  public.is_approved_owner(business_id)
  or public.is_active_employee(business_id)
);
drop policy if exists sessions_member_select on public.sessions;
create policy sessions_member_select on public.sessions for select to authenticated
using (
  public.is_approved_owner(business_id)
  or (public.is_active_employee(business_id) and status in ('draft', 'active', 'paused'))
);
drop policy if exists employee_invitations_owner_select on public.employee_invitations;
create policy employee_invitations_owner_select on public.employee_invitations for select to authenticated
using (public.is_platform_admin() or public.is_approved_owner(business_id));
drop policy if exists admin_audit_logs_authorized_select on public.admin_audit_logs;
create policy admin_audit_logs_authorized_select on public.admin_audit_logs for select to authenticated
using (
  public.is_platform_admin()
  or (business_id is not null and public.is_approved_owner(business_id))
);

-- Resolve the one-time bootstrap email to its Auth UUID. This email is never
-- used by application authorization after the row is created.
do $$
declare
  platform_user_id uuid;
begin
  select id into platform_user_id
  from auth.users
  where lower(email) = lower('omarmassoud20012@gmail.com')
  limit 1;

  if platform_user_id is not null then
    update public.businesses
    set status = 'deleted'
    where id in (
      select business_id from public.business_members
      where user_id = platform_user_id and role = 'owner'
    );
    update public.business_members
    set status = 'removed'
    where user_id = platform_user_id;

    insert into public.platform_admins (user_id, created_by)
    values (platform_user_id, platform_user_id)
    on conflict (user_id) do nothing;

    insert into public.profiles (id, email, account_type, account_status)
    select id, lower(email), 'platform_admin', 'approved'
    from auth.users where id = platform_user_id
    on conflict (id) do update
      set account_type = 'platform_admin', account_status = 'approved';
  end if;
end;
$$;
