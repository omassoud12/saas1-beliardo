alter table public.stations
  add column if not exists exchange_rate numeric check (exchange_rate > 0);

create or replace function public.sync_stations_atomic(
  p_business_id uuid,
  p_actor_user_id uuid,
  p_stations jsonb
)
returns table (outcome text, station_records jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  item_id text;
  item_type text;
  item_number integer;
  item_rate numeric;
  item_exchange_rate numeric;
  station_count integer;
begin
  if not exists (
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
  ) then
    return query select 'forbidden'::text, null::jsonb;
    return;
  end if;

  if jsonb_typeof(p_stations) <> 'array' then
    return query select 'invalid_stations'::text, null::jsonb;
    return;
  end if;
  station_count := jsonb_array_length(p_stations);
  if station_count > 300 then
    return query select 'too_many_stations'::text, null::jsonb;
    return;
  end if;

  perform 1
  from public.stations s
  where s.business_id = p_business_id
  order by s.id
  for update;

  if exists (
    select 1
    from jsonb_array_elements(p_stations) j
    join public.stations s on s.id = j->>'id'
    where s.business_id <> p_business_id
  ) then
    return query select 'id_conflict'::text, null::jsonb;
    return;
  end if;

  if exists (
    select 1
    from public.stations s
    where s.business_id = p_business_id
      and s.archived_at is null
      and not exists (
        select 1 from jsonb_array_elements(p_stations) j where j->>'id' = s.id
      )
      and (
        s.status in ('active', 'paused')
        or exists (
          select 1 from public.sessions se
          where se.business_id = p_business_id
            and se.station_id = s.id
            and se.status in ('draft', 'active', 'paused')
        )
      )
  ) then
    return query select 'station_in_use'::text, null::jsonb;
    return;
  end if;

  for item in select value from jsonb_array_elements(p_stations)
  loop
    item_id := item->>'id';
    item_type := item->>'type';
    item_exchange_rate := null;
    begin
      item_number := (item->>'number')::integer;
      item_rate := (item->>'hourlyRate')::numeric;
      if item ? 'exchangeRate' and jsonb_typeof(item->'exchangeRate') <> 'null' then
        item_exchange_rate := (item->>'exchangeRate')::numeric;
      end if;
    exception when others then
      return query select 'invalid_stations'::text, null::jsonb;
      return;
    end;

    if item_id is null or item_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'
      or item_type not in ('billiard', 'pingpong', 'playstation')
      or item_number < 1 or item_number > 999
      or item_rate < 0 or item_rate > 999
      or (item_exchange_rate is not null and item_exchange_rate <= 0) then
      return query select 'invalid_stations'::text, null::jsonb;
      return;
    end if;

    insert into public.stations (
      id, business_id, type, number, hourly_rate, exchange_rate, status, archived_at
    ) values (
      item_id, p_business_id, item_type, item_number, item_rate, item_exchange_rate, 'available', null
    )
    on conflict (id) do update set
      type = excluded.type,
      number = excluded.number,
      hourly_rate = excluded.hourly_rate,
      exchange_rate = excluded.exchange_rate,
      archived_at = null
    where public.stations.business_id = p_business_id;
  end loop;

  update public.stations s
  set archived_at = now()
  where s.business_id = p_business_id
    and s.archived_at is null
    and not exists (
      select 1 from jsonb_array_elements(p_stations) j where j->>'id' = s.id
    );

  insert into public.admin_audit_logs (
    actor_user_id, business_id, action, metadata
  ) values (
    p_actor_user_id, p_business_id, 'stations.sync',
    jsonb_build_object('station_count', station_count)
  );

  return query
  select 'synchronized'::text, coalesce(jsonb_agg(to_jsonb(s) order by s.type, s.number), '[]'::jsonb)
  from public.stations s
  where s.business_id = p_business_id and s.archived_at is null;
exception
  when unique_violation then
    return query select 'conflict'::text, null::jsonb;
end;
$$;

revoke all on function public.sync_stations_atomic(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_stations_atomic(uuid, uuid, jsonb)
  to service_role;
