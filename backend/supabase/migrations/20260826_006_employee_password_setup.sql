alter table public.profiles
  add column if not exists requires_password_setup boolean not null default false;

-- Existing employee accounts are required to confirm a password once. This is
-- intentionally persisted so closing the invitation tab cannot bypass setup.
update public.profiles
set requires_password_setup = true
where account_type = 'employee' and account_status = 'approved';

create or replace function public.accept_employee_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
) returns table (business_id uuid, invitation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.employee_invitations%rowtype;
  existing_type text;
begin
  select * into invitation
  from public.employee_invitations
  where token_hash = p_token_hash
  for update;

  if invitation.id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  if invitation.status <> 'pending' then raise exception 'INVITATION_ALREADY_USED'; end if;
  if invitation.expires_at <= now() then raise exception 'INVITATION_EXPIRED'; end if;
  if lower(invitation.email) <> lower(p_email) then raise exception 'INVITATION_EMAIL_MISMATCH'; end if;

  select account_type into existing_type from public.profiles where id = p_user_id;
  if existing_type is not null and existing_type <> 'employee' then
    raise exception 'ACCOUNT_TYPE_CONFLICT';
  end if;

  insert into public.profiles (
    id, email, account_type, account_status, requires_password_setup
  ) values (
    p_user_id, lower(p_email), 'employee', 'approved', true
  )
  on conflict (id) do update set
    email = excluded.email,
    account_type = 'employee',
    account_status = 'approved',
    requires_password_setup = true;

  insert into public.business_members (business_id, user_id, role, status)
  values (invitation.business_id, p_user_id, 'employee', 'active')
  on conflict on constraint business_members_pkey
  do update set role = 'employee', status = 'active';

  update public.employee_invitations
  set status = 'accepted', accepted_at = now()
  where id = invitation.id;

  insert into public.admin_audit_logs (
    actor_user_id, target_user_id, business_id, action, metadata
  ) values (
    p_user_id, p_user_id, invitation.business_id, 'invitation.accept',
    jsonb_build_object('invitation_id', invitation.id)
  );

  return query select invitation.business_id, invitation.id;
end;
$$;

revoke all on function public.accept_employee_invitation(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.accept_employee_invitation(text, uuid, text)
  to service_role;
