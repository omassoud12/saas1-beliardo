# Security deployment checklist

Use a disposable Supabase staging project first. Do not apply this sequence directly to production without a backup and a successful staging run.

## 1. Required backend secrets and configuration

- Set `SUPABASE_URL`.
- Set `SUPABASE_ANON_KEY` to the public anon/publishable key. This is required so ordinary backend reads execute with the caller JWT and RLS.
- Keep `SUPABASE_SERVICE_ROLE_KEY` backend-only.
- Set `REDIS_URL` to a TLS-enabled shared Redis instance used by every Railway replica.
- Set exact `CORS_ORIGIN` and `FRONTEND_URL` values.
- Keep `TRUST_PROXY_HOPS=1` only when Railway is the single trusted proxy hop; verify this in staging.
- Never copy secret values into logs, tickets, Git, frontend variables, or this checklist.

## 2. Database rollout

1. Take a staging database backup/snapshot.
2. Apply all migrations in filename order, including `20260830_017_security_hardening.sql`.
3. Verify the migration transaction completed without partial objects.
4. Inspect `pg_policies`, routine grants, `prosecdef`, and each function `search_path`.
5. Confirm the new RPCs are executable only by `service_role`, except the explicitly authenticated read-only analytics functions.
6. Confirm RLS remains enabled on every application table.

The migration keeps the approved product rule: an active Employee may update the hourly price, controller count where applicable, and start time of an open session inside their own active lounge. The operation is tenant-checked and audited.

## 3. Mandatory staging tests

- Use Tenant A Owner/Employee and Tenant B Owner/Employee accounts to attempt cross-tenant SELECT, INSERT, UPDATE, and DELETE with manually substituted IDs. Every attempt must be denied or return no row.
- Test pending, rejected, suspended, deleted, and password-setup-required accounts. Business APIs must remain blocked.
- Attempt invitation acceptance for suspended/deleted/rejected Employees. Expect rejection with unchanged profile, membership, and invitation state.
- Race station removal against session start. The database must never produce an archived station with an open session.
- Confirm a completed session cannot be deleted; only a draft created by the permitted actor may be removed.
- Verify Employee price/start-time edits succeed only for open sessions in the Employee's own lounge and create an audit record.
- Verify Platform Admin status changes update profile/membership/business and audit atomically; confirm suspended/removed Auth users are banned.
- Run two Railway replicas and confirm Redis limits are shared. Forged forwarding headers must not change the effective rate-limit identity.
- Verify Netlify returns CSP, HSTS, frame protection, content-type, referrer, and permissions headers.
- Verify login, signup, password recovery, resend, and email limits in the Supabase Auth dashboard; these provider-owned endpoints do not pass through Express.

## 4. Release gates

- `npm test` passes in `backend` and `frontend`.
- `npm run build` passes in `backend` and `frontend`.
- `npm audit --omit=dev` reports zero known production vulnerabilities.
- Staging RLS/authorization matrix passes with evidence.
- Backup restore is tested in isolation and RPO/RTO are documented.
- Hosting logs are checked with safe canary markers and contain no bearer tokens, cookies, passwords, invitation tokens, or environment values.

Do not launch if any gate above fails.
