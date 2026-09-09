-- Claim a single employee invitation as part of the Auth email-confirmation
-- transaction. This keeps the flow reliable even when an Auth redirect drops
-- the application's invitation query parameter.

create or replace function public.provision_confirmed_employee(
  target_user_id uuid,
  target_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_hashes text[];
  accepted_business_id uuid;
begin
  select array_agg(ei.token_hash order by ei.created_at desc)
  into pending_hashes
  from public.employee_invitations as ei
  where lower(ei.email) = lower(target_email)
    and ei.status = 'pending'
    and ei.expires_at > now();

  -- A token is still required when the same address has invitations to more
  -- than one lounge, so the recipient can select the intended tenant safely.
  if coalesce(array_length(pending_hashes, 1), 0) <> 1 then
    return null;
  end if;

  select accepted.business_id
  into accepted_business_id
  from public.accept_employee_invitation(
    pending_hashes[1],
    target_user_id,
    target_email
  ) as accepted;

  return accepted_business_id;
end;
$$;

revoke all on function public.provision_confirmed_employee(uuid, text)
  from public, anon, authenticated;

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

  if new.email_confirmed_at is not null then
    if registration_type = 'employee' then
      perform public.provision_confirmed_employee(new.id, new.email);
    else
      perform public.provision_confirmed_owner(new.id, new.raw_user_meta_data ->> 'business_name');
    end if;
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
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    if exists (
      select 1 from public.profiles p
      where p.id = new.id and p.account_type = 'employee'
    ) then
      perform public.provision_confirmed_employee(new.id, new.email);
    elsif exists (
      select 1 from public.profiles p
      where p.id = new.id and p.account_type = 'owner'
    ) then
      perform public.provision_confirmed_owner(new.id, new.raw_user_meta_data ->> 'business_name');
    end if;
  end if;
  return new;
end;
$$;

-- Removing an Auth user invalidates every outstanding email link for that
-- user, so keep the application invitation state in sync automatically.
create or replace function public.handle_saas_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.employee_invitations
  set status = 'revoked'
  where lower(email) = lower(old.email)
    and status = 'pending';
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted_saas on auth.users;
create trigger on_auth_user_deleted_saas
before delete on auth.users
for each row execute function public.handle_saas_user_deleted();
