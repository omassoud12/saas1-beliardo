alter table public.sessions
  add column if not exists controller_count smallint not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sessions'::regclass
      and conname = 'sessions_controller_count_check'
  ) then
    alter table public.sessions
      add constraint sessions_controller_count_check
      check (controller_count between 1 and 99);
  end if;
end;
$$;

comment on column public.sessions.controller_count is
  'Controller count selected when a PlayStation session is created; always 1 for other station types.';
