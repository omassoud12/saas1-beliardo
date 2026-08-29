create table if not exists public.stations (
  id text primary key,
  type text not null check (type in ('billiard', 'pingpong', 'playstation')),
  number integer not null check (number > 0),
  hourly_rate numeric(10, 2) not null check (hourly_rate >= 0),
  status text not null check (status in ('available', 'active', 'paused')),
  session_start_at bigint,
  paused_at bigint,
  total_paused_ms bigint not null default 0 check (total_paused_ms >= 0),
  planned_start_at bigint,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stations_active_type_number_key
  on public.stations (type, number)
  where archived_at is null;

alter table public.stations enable row level security;
