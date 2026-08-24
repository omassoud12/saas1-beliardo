create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Beirut',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'manager', 'employee')),
  joined_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

alter table public.stations
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;

alter table public.stations drop constraint if exists stations_type_number_key;
alter table public.stations drop constraint if exists stations_business_type_number_key;
alter table public.stations
  add constraint stations_business_type_number_key unique (business_id, type, number);
alter table public.stations drop constraint if exists stations_id_business_key;
alter table public.stations
  add constraint stations_id_business_key unique (id, business_id);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  station_id text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  hourly_rate numeric(10, 2) not null check (hourly_rate >= 0),
  started_at timestamptz,
  paused_at timestamptz,
  ended_at timestamptz,
  total_paused_seconds bigint not null default 0 check (total_paused_seconds >= 0),
  final_elapsed_seconds bigint check (final_elapsed_seconds >= 0),
  final_cost numeric(12, 2) check (final_cost >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_station_business_fkey
    foreign key (station_id, business_id)
    references public.stations(id, business_id)
    on delete restrict
);

create unique index if not exists sessions_one_open_per_station_idx
  on public.sessions (business_id, station_id)
  where status in ('draft', 'active', 'paused');
create index if not exists sessions_business_status_idx
  on public.sessions (business_id, status);
create index if not exists sessions_business_ended_idx
  on public.sessions (business_id, ended_at desc)
  where status = 'completed';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();
drop trigger if exists stations_set_updated_at on public.stations;
create trigger stations_set_updated_at before update on public.stations
for each row execute function public.set_updated_at();
drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at before update on public.sessions
for each row execute function public.set_updated_at();

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members
    where business_id = target_business_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_business_member(uuid) to authenticated;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.stations enable row level security;
alter table public.sessions enable row level security;

drop policy if exists businesses_member_select on public.businesses;
create policy businesses_member_select on public.businesses for select to authenticated
using (public.is_business_member(id));
drop policy if exists businesses_member_update on public.businesses;
create policy businesses_member_update on public.businesses for update to authenticated
using (public.is_business_member(id)) with check (public.is_business_member(id));

drop policy if exists business_members_member_select on public.business_members;
create policy business_members_member_select on public.business_members for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists stations_member_all on public.stations;
create policy stations_member_all on public.stations for all to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists sessions_member_all on public.sessions;
create policy sessions_member_all on public.sessions for all to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

create or replace function public.handle_new_business_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
begin
  insert into public.businesses (name, created_by)
  values (coalesce(new.raw_user_meta_data ->> 'business_name', 'My Billiard Hall'), new.id)
  returning id into new_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (new_business_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_business on auth.users;
create trigger on_auth_user_created_business
after insert on auth.users
for each row execute function public.handle_new_business_user();

do $$
declare
  existing_user record;
  new_business_id uuid;
begin
  for existing_user in
    select u.id, u.raw_user_meta_data
    from auth.users u
    where not exists (
      select 1 from public.business_members bm where bm.user_id = u.id
    )
  loop
    insert into public.businesses (name, created_by)
    values (coalesce(existing_user.raw_user_meta_data ->> 'business_name', 'My Billiard Hall'), existing_user.id)
    returning id into new_business_id;

    insert into public.business_members (business_id, user_id, role)
    values (new_business_id, existing_user.id, 'owner');
  end loop;
end;
$$;

-- Preserve existing stations only when their ownership is unambiguous.
do $$
begin
  if (select count(*) from public.businesses) = 1 then
    update public.stations
    set business_id = (select id from public.businesses limit 1)
    where business_id is null;
  end if;
end;
$$;
