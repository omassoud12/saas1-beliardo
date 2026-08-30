# Supabase database setup

The ordered files in `migrations/` are the only authoritative database definition. Do not initialize an environment from `schema.sql`.

Apply every migration in filename order to an empty project, then verify tables, RLS, policies, grants, functions, storage policies, and constraints against `SECURITY_AUDIT.md`.

The first Platform Admin is never selected by email. After independently verifying the intended Auth user UUID, an authorized operator must run a reviewed one-time transaction in the Supabase SQL editor:

```sql
begin;
insert into public.platform_admins (user_id, created_by)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000');
update public.profiles
set account_type = 'platform_admin', account_status = 'approved'
where id = '00000000-0000-0000-0000-000000000000';
commit;
```

Replace the placeholder UUID only after review. Record the change externally and confirm the target is not a tenant Owner. Never place an email address or credential in a migration.
