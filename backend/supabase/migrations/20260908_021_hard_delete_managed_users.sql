-- Allow a platform administrator to permanently remove a Supabase Auth user
-- while retaining anonymous operational and audit history.

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table public.platform_admins drop constraint if exists platform_admins_user_id_fkey;
alter table public.platform_admins
  add constraint platform_admins_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.platform_admins drop constraint if exists platform_admins_created_by_fkey;
alter table public.platform_admins
  add constraint platform_admins_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.businesses alter column created_by drop not null;
alter table public.businesses drop constraint if exists businesses_created_by_fkey;
alter table public.businesses
  add constraint businesses_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.sessions alter column created_by drop not null;
alter table public.sessions drop constraint if exists sessions_created_by_fkey;
alter table public.sessions
  add constraint sessions_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.sessions drop constraint if exists sessions_cancelled_by_fkey;
alter table public.sessions
  add constraint sessions_cancelled_by_fkey foreign key (cancelled_by) references auth.users(id) on delete set null;
alter table public.sessions drop constraint if exists sessions_ended_by_fkey;
alter table public.sessions
  add constraint sessions_ended_by_fkey foreign key (ended_by) references auth.users(id) on delete set null;

alter table public.employee_invitations alter column invited_by drop not null;
alter table public.employee_invitations drop constraint if exists employee_invitations_invited_by_fkey;
alter table public.employee_invitations
  add constraint employee_invitations_invited_by_fkey foreign key (invited_by) references auth.users(id) on delete set null;

alter table public.business_report_exports alter column requested_by drop not null;
alter table public.business_report_exports drop constraint if exists business_report_exports_requested_by_fkey;
alter table public.business_report_exports
  add constraint business_report_exports_requested_by_fkey foreign key (requested_by) references auth.users(id) on delete set null;

alter table public.business_expenses alter column created_by drop not null;
alter table public.business_expenses drop constraint if exists business_expenses_created_by_fkey;
alter table public.business_expenses
  add constraint business_expenses_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.business_targets alter column created_by drop not null;
alter table public.business_targets drop constraint if exists business_targets_created_by_fkey;
alter table public.business_targets
  add constraint business_targets_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
