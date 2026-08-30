# SaaS1 Security Audit

**Audit date:** 2026-08-30  
**Audited revision:** `2637942595d95a649a9721169d2ca42fd66b87ca`  
**Scope:** React/Vite frontend, Express backend, Supabase migrations and RLS source, authentication and authorization, invitations, reports, deletion, configuration, deployment files, current Git tree, and Git history.  
**Method:** Static analysis, configuration review, secret-safe searches, existing non-destructive tests, dependency audit, and inspection of existing local build output. No database, production, or external service was mutated.

## Remediation implementation update — 2026-08-30

The user subsequently approved implementation of the audit remediations, with one explicit product rule: an active Employee must remain able to edit the hourly price, applicable controller count, and start time of any open session in their own active lounge. That behavior is intentional, tenant-checked, and now audited; initial item SEC-005 is therefore an accepted authorization rule, not an unresolved vulnerability.

The current worktree implements source-level remediations for SEC-001 through SEC-018 (SEC-019 is historical information). In particular:

- Completed-session hard deletion is blocked; only an eligible draft can be transactionally deleted and audited.
- Station synchronization is a caller-validating, row-locking RPC; the client no longer controls live state.
- Ordinary reads use a caller-JWT Supabase client under RLS. Service role remains limited to Auth/admin/storage and caller-validating privileged RPCs.
- Invitation acceptance locks the token row and rejects suspended, deleted, and rejected profiles.
- Pause, resume, open-session updates, station sync, and Platform Admin transitions are atomic RPC operations with server-side role/tenant checks; relevant mutations are audited.
- Password setup now changes Supabase Auth through the authenticated token before clearing the application gate, and invite/reset tokens are scrubbed from the URL immediately.
- Production requires a shared Redis store and has endpoint-specific `429` limits; analytics ranges are bounded.
- CSP/HSTS were added, Chromium `--no-sandbox` was removed, platform bootstrap no longer contains a fixed email, schema guidance is migration-authoritative, resend rollback is supported, and 5xx logs use redacted structured events with request IDs.
- Puppeteer was upgraded to 25.9.0; the production dependency audit reports zero known vulnerabilities.

Verification completed against the local worktree: backend tests **94/94 PASS**, frontend tests **30/30 PASS**, backend build **PASS**, frontend production build **PASS**, and backend `npm audit --omit=dev` **0 vulnerabilities**. The Supabase CLI/PostgreSQL client and a disposable staging database were unavailable, so migration execution, deployed RLS catalog inspection, concurrent database tests, and the live Tenant A/Tenant B matrix remain blocked.

Accordingly, the original finding descriptions below remain useful as the audit evidence and threat model, but their source-remediation status is superseded by this update. They are not yet marked deployed/verified. Follow `SECURITY_DEPLOYMENT_CHECKLIST.md` before release.

## 1. Executive summary

### Overall security status

SaaS1 has several strong controls: backend identity is derived from a verified Supabase token; tenant, role, approval, and membership context is resolved from the database; platform-admin authorization is database-backed at runtime; owner-only routes are protected server-side; queries reviewed consistently scope tenant objects by the authenticated business; final migration source removes authenticated table writes; invitations use 256-bit random tokens, store SHA-256 hashes, expire, and are consumed atomically; React output is escaped; report HTML explicitly escapes owner-controlled content; CORS uses exact origins; and all 124 local tests passed.

The application is nevertheless **not ready for production launch** until the new migration and deployment controls pass staging verification. The initial audit found four High-severity conditions, all now remediated in the current source but not yet deployed or runtime-verified:

1. Completed-session hard deletion without audit.
2. Non-atomic station synchronization and client-controlled live state.
3. Universal service-role use for ordinary backend tenant reads.
4. Invitation acceptance reactivation of suspended/deleted Employees.

No Critical finding or confirmed cross-tenant data disclosure was found in the audited source. Runtime RLS state and the required multi-account tenant-isolation matrix could not be verified without a disposable local/staging Supabase project and test accounts. That missing runtime evidence is a launch gate, not a PASS.

### Finding counts

| Severity | Confirmed | Potential | Total |
|---|---:|---:|---:|
| Critical | 0 | 0 | 0 |
| High | 4 | 0 | 4 |
| Medium | 10 | 2 | 12 |
| Low | 2 | 1 | 3 |
| Informational | 1 | 0 | 1 |

### Final launch decision

**NOT SAFE TO LAUNCH**

The High-severity defects have source-level remediations in the current worktree. This decision now remains because the hardening migration has not been executed or syntax/runtime-tested against disposable Supabase staging, and there is still no live proof that deployed RLS and Tenant A/Tenant B isolation match the source.

## 2. Architecture and trust boundaries

### Components and privileged clients

| Component | Client/credential | Trust level | Evidence |
|---|---|---|---|
| Browser frontend | Auth-only `AuthClient`; `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` | Untrusted client; public publishable key only | `frontend/src/lib/supabase.js:1-15` |
| Frontend to backend | Supabase access token in `Authorization: Bearer`; optional `X-Business-Id` | Untrusted request until backend verification | `frontend/src/lib/api.js`; `backend/src/middleware/authenticate.js:7-22` |
| Backend authentication | Service-role client calls `auth.getClaims(token)` and `get_request_access_context` | Privileged server boundary | `backend/src/middleware/authenticate.js:12-35` |
| Backend data access | Caller-JWT client for ordinary reads; admin client for explicit Auth/admin/storage and caller-validating RPCs | RLS-governed reads plus narrow privileged operations | `backend/src/config/supabaseUser.js`; `backend/src/config/supabaseAdmin.js`; repository imports |
| Direct authenticated Supabase data access | Migration source grants authenticated users SELECT only, filtered by RLS | Defense in depth for direct client reads; runtime state not verified | `backend/supabase/migrations/20260825_004_platform_tenants_and_invitations.sql:257-309` |
| Privileged RPCs | Service-role-only invitation acceptance, access context, session start/end/cancel, analytics/report reservation | Privileged server operations | migrations `005`, `009`-`013`, `015`-`016` |
| Report storage | Private Supabase bucket, accessed by service role | Privileged backend-only storage | `backend/supabase/migrations/20260828_013_business_report_exports.sql:38-45`; `business-report.repository.js` |
| Frontend hosting | Netlify configuration in repository; Vercel not configured here | Public edge | `netlify.toml` |
| Backend hosting | Production Docker image; no Railway-specific config in repository | Public API edge/reverse proxy | `backend/Dockerfile`; `backend/src/app.js` |

### Identity and authorization flow

1. The backend rejects missing/malformed bearer headers and validates the token with Supabase `getClaims`; the user ID is the verified `sub`, not a body `user_id` (`authenticate.js:7-15`).
2. The optional `X-Business-Id` is passed to service-only `get_request_access_context`; the function returns a context only for the verified user. Role, tenant, membership, profile status, business status, and platform-admin status come from database rows (`authenticate.js:18-35`; migration `010:9-57`).
3. `requireHomeAccess`, `requireApprovedOwner`, and `requirePlatformAdmin` enforce approval, password-setup, tenant, membership, and role state server-side (`accessGuards.js:3-42`).
4. Controllers pass `request.auth.businessId` and `request.auth.user.id` into services. The reviewed tenant repositories apply `business_id` filters or use RPCs that validate business membership.
5. Ordinary read repositories execute with the verified caller JWT and RLS. Privileged mutations use narrowly scoped RPCs that independently validate actor, tenant, role, status, and object state; Auth/admin/storage operations retain the service role.

### Protected resources and sensitive endpoint inventory

| Route family | Sensitive actions | Server guard |
|---|---|---|
| `/api/access` | View access state; mark password configured | Authenticated; second action has finding SEC-006 |
| `/api/platform` | List users/owners/audit logs; approve, reject, suspend, reactivate, edit, or remove users | Authenticated + database-backed platform admin |
| `/api/employees` | List employees/invitations; create, resend, revoke, accept; disable/reactivate/remove employee | Acceptance authenticated; management authenticated Owner |
| `/api/stations` | Read stations; synchronize/create/update/archive full station list | Read Home role; write Owner |
| `/api/sessions` | Create, start, read, pause, resume, edit, cancel, end, delete; read completed history | Home role; completed history Owner-only; other operations Owner or Employee |
| `/api/dashboard` | Revenue, operational counts, charts | Owner |
| `/api/business` | Daily/monthly/yearly analytics; PDF generation/list/download | Owner; PDF-specific limiters |

The review did not rely on hidden frontend buttons. All Express routes and their middleware were inspected directly.

### Application data model and deletion relationships

Application tables found in migrations: `businesses`, `business_members`, `stations`, `sessions`, `profiles`, `platform_admins`, `employee_invitations`, `admin_audit_logs`, and `business_report_exports`. Business deletion cascades to memberships, stations, sessions, invitations, and report-export metadata; audit-log business references become `NULL`; Auth/profile/admin references generally restrict Auth deletion or become `NULL` for audit actors. Storage objects are not foreign-key managed. The application currently soft-marks owners/businesses/memberships as deleted/removed instead of deleting the business row.

## 3. Secret and credential audit

No complete credential is reproduced in this report.

| Type | Location | Active/historical | Result | Required remediation |
|---|---|---|---|---|
| Supabase service-role key | `backend/.env` as `SUPABASE_SERVICE_ROLE_KEY=[REDACTED]` | Appears active locally | File is ignored and untracked. The active value was compared in memory against frontend source and existing build output; no match. No matching service-role value/name assignment was found in Git history. | Keep only in backend/hosting secret storage. Restrict staff access. Rotate immediately if this environment or its logs were exposed. |
| Supabase anonymous/publishable key | `frontend/.env` as `VITE_SUPABASE_ANON_KEY=[REDACTED]` | Appears active | Expected public credential. It is not the service-role key. | Keep RLS effective; do not treat this key as authorization. |
| Historical Supabase anonymous JWT-shaped publishable key | `frontend/.env.example` in commits `f2657fa` and `2c23f51` | Historical | Redacted inspection identified an `anon` role claim, not `service_role`. It is public by design but exposes a historical project identifier and should not be used as an example value. | Retain placeholders only. Confirm the role in the Supabase dashboard; rotate only if it was misclassified or the project should be decommissioned. |

Evidence:

- `.gitignore:1-5` ignores `node_modules`, `dist`, `.env`, and `.env.*`, while allowing `.env.example`.
- `git ls-files` lists only `backend/.env.example` and `frontend/.env.example`; both contain placeholders.
- Current-tree searches found no hardcoded JWT, PEM private key, database URL credential, or service-role assignment.
- Existing frontend bundle scans found no active service-role value.
- Backend logging does not intentionally print environment variables or authorization headers, but raw 500-error logging is a potential leak path (SEC-016).

If any real credential is later found in Git history: rotate it immediately, remove it from the current repository, clean Git history when necessary, and redeploy with the replacement. No rotation or history rewrite was performed during this audit.

## 4. Findings

### Findings summary

| ID | Title | Severity | Confidence | Affected component |
|---|---|---|---|---|
| SEC-001 | Completed financial sessions can be permanently deleted without audit | High | Confirmed | Sessions API/database |
| SEC-002 | Station synchronization trusts live client state and has a start/archive race | High | Confirmed | Stations and sessions |
| SEC-003 | Ordinary backend tenant access uses service role and bypasses RLS | High | Confirmed | Backend/Supabase boundary |
| SEC-020 | Invitation acceptance reactivates suspended or deleted Employees | High | Confirmed | Invitation/auth status |
| SEC-004 | Legacy session transitions are non-transactional | Medium | Confirmed | Session lifecycle |
| SEC-005 | Employees can alter price, controller count, and start time on any open tenant session | Medium | Potential | Session authorization |
| SEC-006 | Password-setup enforcement can be cleared without proving a password change | Medium | Confirmed | Invitation/access control |
| SEC-007 | Sensitive rate limits are incomplete and process-local | Medium | Confirmed | API abuse controls |
| SEC-008 | Invitation bearer token remains in the URL until successful acceptance | Medium | Confirmed | Invitation flow/frontend |
| SEC-009 | Platform-admin state transitions are non-transactional and audit last | Medium | Confirmed | Platform administration |
| SEC-010 | Analytics accepts unbounded date ranges and loads every matching session | Medium | Confirmed | Dashboard analytics |
| SEC-011 | `schema.sql` is incomplete and conflicts with the migration-defined tenant schema | Medium | Confirmed | Database deployment |
| SEC-012 | User/tenant deletion lifecycle and storage cleanup are incomplete | Medium | Confirmed | Data lifecycle |
| SEC-013 | Frontend deployment lacks a Content Security Policy | Medium | Confirmed | Netlify/frontend headers |
| SEC-014 | PDF Chromium runs without its browser sandbox | Medium | Confirmed | Report generation |
| SEC-015 | Platform-admin bootstrap depends on a hardcoded email in a migration | Medium | Potential | Admin provisioning |
| SEC-016 | Raw server errors are logged for all 5xx responses | Low | Potential | Logging |
| SEC-017 | Backend input validation has targeted gaps | Low | Confirmed | Headers/signup/stations/search |
| SEC-018 | Invitation resend rotates the token before delivery succeeds | Low | Confirmed | Invitation lifecycle |
| SEC-019 | Historical publishable key was present in example-file history | Informational | Confirmed | Git history |

### SEC-001 — Completed financial sessions can be permanently deleted without audit

- **Severity / confidence:** High / Confirmed
- **Affected component:** `DELETE /api/sessions/:id`, session service/repository
- **References:** `backend/src/features/sessions/session.routes.js:30`; `session.service.js:352-360`; `session.repository.js:185-190`
- **Evidence:** Owners pass the Home guard. The service explicitly permits `completed` status, and the repository executes `.delete()` scoped only by `business_id` and session ID. No soft-delete field or audit insert is part of this path.
- **Attack scenario:** A malicious or compromised Owner enumerates completed-session IDs from Owner-only history and deletes selected revenue records. The entries disappear after refresh and cannot be reconstructed from application data.
- **Business impact:** Destruction of revenue history, reports, billing evidence, dispute evidence, and operational accountability. Backups are the only recovery path found.
- **Recommended remediation:** Prohibit hard deletion of completed sessions. Use an append-only correction/void workflow or a soft-delete with reason, actor, timestamp, before-image, explicit confirmation, retention policy, and audit log. Make the operation idempotent and transactionally update related aggregates if any.
- **Verification after remediation:** As an Owner, `DELETE` a completed disposable session and verify either `409` or a retained soft-deleted row plus immutable audit event; confirm reports preserve or explicitly show the correction. Verify Employee, cross-tenant Owner, suspended user, and unauthenticated requests remain denied.

### SEC-002 — Station synchronization trusts live client state and has a start/archive race

- **Severity / confidence:** High / Confirmed
- **Affected component:** `PUT /api/stations`, station sync, atomic session start
- **References:** `backend/src/features/stations/station.validation.js:8-26`; `station.service.js:15-26`; `station.repository.js:82-112`; migration `20260830_016_archive_deleted_stations.sql:11-124`
- **Evidence:** The client may submit `status`, start/pause timestamps, pause totals, and planned start values. The server first reads/checks removed stations, then separately upserts incoming rows, then archives removed IDs. `archiveByIds` checks only business, unarchived state, and ID; it does not lock rows or re-check station availability/open sessions.
- **Attack scenario:** An Owner submits a sync that removes an available station while an Employee concurrently starts a session on it. The atomic start locks/activates the station after the service's stale pre-check, then the later archive query hides the now-active station. An Owner can also directly overwrite server-managed live state in the sync payload.
- **Business impact:** Hidden live sessions, inconsistent station/session state, incorrect billing, failed operational actions, and difficult recovery.
- **Recommended remediation:** Move station sync into one transaction/RPC. Lock affected station rows; make live state server-owned and ignore/reject it in configuration payloads; archive only when `status='available'` and no open session exists inside the same transaction. Record actor and reason.
- **Verification after remediation:** Run concurrent disposable staging requests for station removal and session start. Exactly one must win; the database must never contain an archived station with an active/paused session. Attempt to send forged live-state fields and verify rejection or stripping.

### SEC-003 — Ordinary backend tenant access uses service role and bypasses RLS

- **Severity / confidence:** High / Confirmed
- **Affected component:** Backend/Supabase trust boundary
- **References:** `backend/src/config/supabaseAdmin.js:6-14`; repository imports throughout `backend/src/features`; migration `20260825_004_platform_tenants_and_invitations.sql:257-309`
- **Evidence:** A single service-role client is used for token validation, ordinary tenant SELECTs, ordinary writes, admin actions, invitations, reports, and storage. Supabase service role bypasses RLS. Final migration source revokes authenticated writes, so the backend cannot switch to a user-scoped client without adding appropriate RLS/RPC paths.
- **Attack scenario:** A future endpoint omits one `business_id` predicate, accepts an unsafe identifier, or contains an authorization bug. Because the database request is service-role, RLS cannot contain the defect and cross-tenant data may be read or changed.
- **Business impact:** Loss of defense in depth across every tenant, with potentially platform-wide confidentiality and integrity impact from one application-layer defect.
- **Recommended remediation:** Maintain separate clients: a user-scoped Supabase client carrying the verified caller JWT for ordinary RLS-governed operations, and a narrowly used service-role client for explicit admin/Auth/storage/RPC tasks. Add least-privilege RLS write policies or narrowly scoped, caller-validating RPCs. Add automated assertions that ordinary repositories cannot import the admin client.
- **Verification after remediation:** Instrument staging to prove ordinary reads/writes execute as `authenticated`; use Tenant A credentials with Tenant B IDs for SELECT/INSERT/UPDATE/DELETE and verify zero rows/403 at the database layer. Confirm service-role imports are limited to an allowlist.

### SEC-020 — Invitation acceptance reactivates suspended or deleted Employees

- **Severity / confidence:** High / Confirmed
- **Affected component:** `POST /api/employees/invitations/accept`, invitation RPC
- **References:** `backend/src/features/employees/employee.routes.js:9`; `backend/supabase/migrations/20260827_008_resolve_invitation_business_id_ambiguity.sql:29-75`
- **Evidence:** The acceptance route requires authentication but deliberately does not apply account-status guards. The RPC allows an existing `employee` profile regardless of current status, then unconditionally sets `profiles.account_status='approved'`, `requires_password_setup=true`, and the target membership to `active`. This overwrites `suspended` or `deleted` state.
- **Attack scenario:** A Platform Admin suspends or removes an Employee. A colluding/compromised Owner creates a new invitation for the same email, or the Employee uses a pending invitation. The Employee accepts it and the RPC restores approved/active state; they complete or bypass password setup (SEC-006) and regain Home/session access.
- **Business impact:** Bypass of platform-wide suspension/deletion, unauthorized return of a removed account, and loss of central administrative control.
- **Recommended remediation:** In the locked acceptance transaction, reject profiles in `suspended`, `deleted`, or `rejected` states. Only a Platform Admin transition may clear those states. Distinguish benign re-invitation of an active/removed membership from platform account status, and consume no token on rejection.
- **Verification after remediation:** For suspended, deleted, rejected, pending, and approved Employee fixtures, accept a valid matching invitation. Expect suspended/deleted/rejected to remain unchanged and receive `403`; only explicitly permitted states may activate. Verify atomic rollback and audit behavior.

### SEC-004 — Legacy session transitions are non-transactional

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** `POST /sessions/:id/start|pause|resume`, legacy create/start path
- **References:** `backend/src/features/sessions/session.service.js:111-133`, `173-194`, `199-242`
- **Evidence:** These methods update a session and station in separate Supabase calls. New combined start, cancel, and end flows use atomic RPCs, but the legacy endpoints remain exposed.
- **Attack scenario:** The session update succeeds and the station update fails, or two workers interleave changes, leaving the session and station with conflicting states.
- **Business impact:** Availability failures, duplicate/blocked sessions, and billing inaccuracies.
- **Recommended remediation:** Remove unused legacy endpoints or convert every state transition to a row-locking, membership-validating transaction/RPC with idempotency semantics.
- **Verification after remediation:** Inject a controlled failure between changes in staging and prove both rows roll back. Replay the same transition and verify a deterministic idempotent response.

### SEC-005 — Employees can alter price, controller count, and start time on any open tenant session

- **Severity / confidence:** Medium / Potential
- **Affected component:** `PATCH /api/sessions/:id`
- **References:** `backend/src/features/sessions/session.routes.js:15-30`; `session.validation.js:112-130`; `session.service.js:246-272`
- **Evidence:** The route uses Home access, which admits approved Employees. The update service has no role or creator check and accepts hourly rate, controller count, and any non-future start time for any draft/active/paused session in the tenant.
- **Attack scenario:** An Employee reduces a rate, increases controller count, or backdates another employee's live session, changing financial results. This may be intended operational authority, so confidence in policy mismatch is Potential.
- **Business impact:** Insider revenue manipulation and weak accountability.
- **Recommended remediation:** Define the business permission explicitly. Prefer Owner-only rate/start-time corrections, or require bounded correction windows, reason codes, before/after audit events, and per-session operator ownership.
- **Verification after remediation:** Test owner, creating Employee, different Employee, suspended Employee, and cross-tenant Employee against each editable field and confirm the documented policy plus audit record.

### SEC-006 — Password-setup enforcement can be cleared without proving a password change

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** `POST /api/access/password-configured`
- **References:** `backend/src/features/access/access.routes.js:6-7`; `access.controller.js:8-11`; `access.repository.js:5-11`; `frontend/src/components/PasswordSetup.jsx:16-18`
- **Evidence:** The frontend changes the Supabase password first, but any authenticated caller can call the backend endpoint directly. The backend simply sets `requires_password_setup=false` and cannot prove a password update occurred.
- **Attack scenario:** A holder of an invitation-derived authenticated session calls the endpoint directly and gains business APIs without completing the required password setup.
- **Business impact:** Bypass of an intended account-hardening control and potentially fragile account recovery/sign-in state.
- **Recommended remediation:** Derive completion from a trusted Supabase Auth event/claim or perform a server-side verified reauthentication/password workflow. Do not expose an unauthenticated assertion-style flag change.
- **Verification after remediation:** Call the endpoint without a qualifying password change and expect `403/409`; complete the real password flow and verify the flag transitions once.

### SEC-007 — Sensitive rate limits are incomplete and process-local

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** API and reverse-proxy abuse protection
- **References:** `backend/src/middleware/security.js:4-56`; `backend/src/app.js:18-23`; route files
- **Evidence:** There is a 300 requests/5 minutes default-IP limiter and tenant-keyed PDF limits. No shared store is configured, so `express-rate-limit` uses process memory. No dedicated limits exist for invitation create/accept/resend, admin approval/removal, analytics, destructive session deletion, or repeated session state transitions. Login/registration/reset requests go directly to Supabase Auth; dashboard rate settings were not available.
- **Attack scenario:** An authenticated attacker abuses expensive or destructive endpoints below the broad threshold, or bypasses limits across Railway replicas/restarts. A proxy misconfiguration may group users or use the wrong address.
- **Business impact:** Email abuse, resource exhaustion, repeated state mutation, administrative brute force, and unreliable protection after horizontal scaling.
- **Recommended remediation:** Use a shared Redis-compatible store in distributed production; add per-IP plus per-user/tenant/action limits to every listed sensitive route; retain safe `429` bodies; document and integration-test the exact trusted proxy hop count on Railway. Configure and verify Supabase Auth rate limits separately.
- **Verification after remediation:** From staging through the real proxy, exceed each limit and verify consistent `429`, safe text, correct client grouping, no `X-Forwarded-For` bypass, and consistency across two replicas.

### SEC-008 — Invitation bearer token remains in the URL until successful acceptance

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** Employee invitation delivery and frontend callback
- **References:** `backend/src/features/employees/employee.service.js:37-46`; `frontend/src/App.jsx:34-54`; `netlify.toml:16`
- **Evidence:** The raw token is delivered as `/?invite=...`. The frontend removes it with `history.replaceState` only after an authenticated acceptance succeeds. An unauthenticated recipient may keep the token in the address bar/history for the entire sign-in/signup flow. The strict-origin-when-cross-origin policy limits cross-origin referrer leakage but does not remove URL, browser-history, hosting-access-log, screenshot, or copied-link exposure.
- **Attack scenario:** A URL is captured from browser history, edge logs, support screenshots, shared clipboard, or same-origin telemetry before acceptance. Email matching and one-time atomic consumption mitigate but do not eliminate bearer-token exposure.
- **Business impact:** Increased invitation-account takeover opportunity and sensitive-token retention.
- **Recommended remediation:** On first client execution, copy the token to short-lived in-memory/session state and immediately scrub the URL before network/analytics work. Prefer an opaque one-time exchange route. Ensure edge/application analytics redact the parameter and use `Referrer-Policy: no-referrer` on the callback.
- **Verification after remediation:** Load an invitation while signed out and verify the query is removed immediately, no request/log/analytics event contains the token, and successful/used/expired flows still behave correctly.

### SEC-009 — Platform-admin state transitions are non-transactional and audit last

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** Platform approval, suspension, reactivation, removal
- **References:** `backend/src/features/platform/platform.service.js:18-25`, `62-83`; `platform.repository.js:44-60`
- **Evidence:** Profile, business, membership, and audit rows are written sequentially through separate requests. A failure can leave mixed status and no audit record.
- **Attack scenario:** A transient database/network failure occurs after profile approval but before membership/business update, or after the security change but before audit insertion.
- **Business impact:** Inconsistent authorization state, accidental lockout/access, and missing administrative accountability.
- **Recommended remediation:** Implement each transition as one transaction/RPC with row locks, allowed transition checks, and audit insertion in the same commit. Make retry behavior idempotent.
- **Verification after remediation:** Inject failure at each write boundary and verify full rollback; repeat a transition and verify one consistent state and one deduplicated audit event.

### SEC-010 — Analytics accepts unbounded date ranges and loads every matching session

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** `GET /api/dashboard/charts/:granularity`
- **References:** `backend/src/features/dashboard/dashboard.validation.js:21-34`; `dashboard.service.js:42-72`; `dashboard.repository.js:5-28`
- **Evidence:** Dates and granularity are syntactically validated, but no maximum range exists. The repository pages in batches of 1,000 until every completed session is loaded into memory. Only the broad process-local limiter applies.
- **Attack scenario:** An Owner repeatedly requests multi-year ranges for a large tenant, driving database, API memory, and CPU usage.
- **Business impact:** Tenant or service-wide availability degradation and cost amplification.
- **Recommended remediation:** Enforce a granularity-specific maximum range, aggregate in SQL/RPC, cap returned buckets, cache safe summaries, and add per-tenant expensive-query limits/timeouts.
- **Verification after remediation:** Submit over-limit ranges and expect `400`; load-test the maximum permitted range in staging and verify bounded rows, memory, latency, and replica-consistent limits.

### SEC-011 — `schema.sql` is incomplete and conflicts with the migration-defined tenant schema

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** Database deployment/recovery
- **References:** `backend/supabase/schema.sql:1-20`; `backend/supabase/migrations/20260824_001_tenant_sessions_dashboard.sql`; migration `004`
- **Evidence:** `schema.sql` declares only `stations`, omits `business_id`, uses a global active `(type, number)` unique index, and enables RLS without policies. The migrations define the actual multi-tenant schema and policies.
- **Attack scenario:** An operator bootstraps or restores an environment using `schema.sql`, believing it authoritative.
- **Business impact:** Broken tenant model, missing controls/tables, deployment drift, or unsafe recovery.
- **Recommended remediation:** Declare one authoritative migration workflow, remove or auto-generate the snapshot, and validate a fresh database in CI against expected tables, constraints, RLS, policies, grants, and functions.
- **Verification after remediation:** Provision an empty disposable project using documented steps and compare catalog state to a checked manifest.

### SEC-012 — User/tenant deletion lifecycle and storage cleanup are incomplete

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** Platform user removal, tenant lifecycle, storage, backups
- **References:** `backend/src/features/platform/platform.service.js:73-83`; `business-report.repository.js:53-116`; migration foreign keys in `001`, `004`, `013`
- **Evidence:** Platform removal soft-marks profile, membership, and Owner business status in separate calls. It does not disable/delete the Supabase Auth user, clean private report objects, or provide a transactional tenant deletion/recovery job. No Owner self-deletion/tenant-deletion endpoint, backup verification, legal retention workflow, or storage reconciliation process was found.
- **Attack scenario:** A removed Owner's application rows are disabled but Auth account and tenant storage persist indefinitely; a partial platform removal leaves mixed state. A future hard delete could cascade tenant data while storage remains orphaned.
- **Business impact:** Privacy/retention non-compliance, orphaned cost, inconsistent identities, and unrecoverable deletion risk.
- **Recommended remediation:** Design an explicit state machine: suspend access immediately, queue idempotent cleanup, preserve required financial/audit records, reconcile Auth/profile/storage, require high-friction confirmation for permanent tenant deletion, and verify backups/restores before purge.
- **Verification after remediation:** Use a disposable tenant with sessions, invites, reports, storage, and members. Run deletion twice; verify immediate access denial, documented retention, complete storage handling, preserved audit, and tested restore.

### SEC-013 — Frontend deployment lacks a Content Security Policy

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** Netlify/frontend response headers
- **References:** `netlify.toml:11-17`
- **Evidence:** The frontend sets nosniff, frame denial, referrer, and permissions headers but no `Content-Security-Policy`. Explicit HSTS is also absent from repository configuration; platform defaults were not verified.
- **Attack scenario:** A future DOM/template or compromised third-party dependency injection has fewer browser-enforced limits.
- **Business impact:** Increased impact of XSS/supply-chain compromise and weaker defense in depth.
- **Recommended remediation:** Deploy a tested restrictive CSP (`default-src`, `script-src`, `connect-src`, `img-src`, `style-src`, `font-src`, `frame-ancestors`, `base-uri`, `form-action`, `object-src`) tailored to Vite, Supabase Auth, and the API. Start with report-only. Explicitly configure/verify HSTS at the production edge.
- **Verification after remediation:** Capture production headers, confirm CSP/HSTS, run core flows without violations, and verify injected inline script and framing are blocked.

### SEC-014 — PDF Chromium runs without its browser sandbox

- **Severity / confidence:** Medium / Confirmed
- **Affected component:** Server-side PDF generation
- **References:** `backend/src/features/business/business-report.pdf.js:5-8`, `51-61`; `backend/Dockerfile:16-17`
- **Evidence:** Puppeteer launches with `--no-sandbox` and `--disable-setuid-sandbox`. The container runs as non-root and report HTML is escaped, which reduce risk, but browser sandbox isolation is intentionally disabled.
- **Attack scenario:** A Chromium vulnerability reached through report content compromises the Node container with less browser-level containment.
- **Business impact:** Backend container compromise and possible service-role credential exposure.
- **Recommended remediation:** Run Chromium with a supported sandbox in a hardened isolated worker/container, minimal network/secret access, read-only filesystem where possible, seccomp/AppArmor, CPU/memory/time limits, and no service-role credential in the renderer process.
- **Verification after remediation:** Assert launch succeeds without no-sandbox flags and test worker isolation, timeout, egress, filesystem, and crash cleanup.

### SEC-015 — Platform-admin bootstrap depends on a hardcoded email in a migration

- **Severity / confidence:** Medium / Potential
- **Affected component:** Initial platform-admin provisioning
- **References:** `backend/supabase/migrations/20260825_004_platform_tenants_and_invitations.sql:311-326`, especially line 319 (`[REDACTED PLATFORM BOOTSTRAP EMAIL]`)
- **Evidence:** Runtime authorization correctly uses `platform_admins`, not email. However, the migration resolves a fixed email to an Auth UUID and inserts the admin record. In a fresh/replayed environment, control of that address at migration time controls bootstrap.
- **Attack scenario:** The fixed mailbox is reassigned/compromised or the migration is run against an unexpected Auth project containing that address.
- **Business impact:** Platform-wide administrator grant.
- **Recommended remediation:** Replace email bootstrap with a documented, one-time, operator-approved UUID grant outside general migrations; verify identity out-of-band; record the grant; then remove/disable the bootstrap path.
- **Verification after remediation:** A fresh migration must create no platform admin automatically. The explicit grant must require the intended UUID and produce an audit record.

### SEC-016 — Raw server errors are logged for all 5xx responses

- **Severity / confidence:** Low / Potential
- **Affected component:** Backend logging/error handling
- **References:** `backend/src/middleware/errorHandler.js:3-16`; `shared/utils/database.js:3-11`
- **Evidence:** Every 5xx path calls `console.error(error)`. Unknown Supabase/provider errors are rethrown, so the logged object may include internal details or PII. No complete token/key logging statement was found, and production client responses hide non-operational 500 messages.
- **Attack scenario:** Crafted failures cause provider error objects containing sensitive metadata to enter long-lived hosting logs.
- **Business impact:** Internal information or personal data disclosure to log readers and excessive retention.
- **Recommended remediation:** Use structured allowlisted logging with request ID, event, safe actor/business IDs, result, and redacted code; never serialize headers, cookies, tokens, bodies, URLs with tokens, provider objects, or environment values.
- **Verification after remediation:** Trigger representative validation, provider, database, and PDF failures with canary secret strings and confirm neither logs nor responses contain them.

### SEC-017 — Backend input validation has targeted gaps

- **Severity / confidence:** Low / Confirmed
- **Affected component:** Tenant header, station sync, signup metadata, invitation lookup
- **References:** `authenticate.js:18-22`; `station.validation.js:8-42`; `AuthGate.jsx:26-28,63`; migration `004:94-113,145-167`; `employee.repository.js:10`
- **Evidence:** `X-Business-Id` is not UUID-validated before a UUID RPC; station sync does not cap array length and accepts unvalidated timestamp/live-state fields; database signup triggers accept `raw_user_meta_data.business_name` without the frontend's 80-character limit; `.ilike(email)` does not escape `%`/`_` wildcard semantics. JSON is capped at 256 KB and most validators construct allowlisted output, limiting impact.
- **Attack scenario:** Malformed headers create avoidable 500/log noise; direct Supabase signup stores oversized names; large station lists or malformed timestamps cause resource/integrity problems; wildcard-like emails affect duplicate-invitation matching.
- **Business impact:** Availability noise, inconsistent data, and validation bypass of frontend-only constraints.
- **Recommended remediation:** Validate header UUID before RPC; cap station count and validate every timestamp/relationship; add database constraints for names; use exact normalized email comparison or escape pattern characters.
- **Verification after remediation:** Submit malformed/oversized/unknown inputs and verify deterministic `400`, no provider detail, no partial writes, and no wildcard match.

### SEC-018 — Invitation resend rotates the token before delivery succeeds

- **Severity / confidence:** Low / Confirmed
- **Affected component:** Invitation resend
- **References:** `backend/src/features/employees/employee.service.js:68-74`
- **Evidence:** The pending invitation hash/expiry is replaced before the email provider call. Unlike initial creation, resend has no rollback path if delivery fails.
- **Attack scenario:** A transient email failure invalidates the previously delivered still-valid token while the replacement token is never received.
- **Business impact:** Invitation availability failure and support burden; no direct confidentiality bypass.
- **Recommended remediation:** Make rotation and delivery state explicit: create a pending-delivery version, switch active hash only after successful delivery where feasible, or preserve a safely bounded previous token until delivery confirmation. Audit failure without logging tokens.
- **Verification after remediation:** Force delivery failure and verify the prior invitation remains valid or a deterministic recovery/resend path exists.

### SEC-019 — Historical publishable key was present in example-file history

- **Severity / confidence:** Informational / Confirmed
- **Affected component:** Git history
- **References:** `frontend/.env.example` in commits `f2657fa` and `2c23f51`
- **Evidence:** Secret-safe claim inspection identified a Supabase `anon`/publishable role, not service role. No actual value is reported.
- **Attack scenario / impact:** The public key does not grant more than RLS allows, but it identifies a historical project and creates confusion during secret review.
- **Recommended remediation:** Keep placeholders only and document that publishable keys are public but RLS is mandatory. Confirm the key's role in the provider dashboard.
- **Verification after remediation:** Automated history/current-tree scanning distinguishes publishable from secret/service credentials and blocks secret patterns.

## 5. Security-control checklist

Status values are exactly: **PASS**, **FAIL**, **PARTIAL**, **NOT IMPLEMENTED**, **NOT TESTED**, or **NOT APPLICABLE**. PASS means direct source/test evidence was found; it does not imply that the deployed environment was inspected.

### Secrets and privileged clients

| Control | Status | Evidence/qualification |
|---|---|---|
| Service-role key is absent from frontend source | PASS | Frontend client uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; active-value scan found no match. |
| Service role is not referenced through `VITE_*`, `NEXT_PUBLIC_*`, `REACT_APP_*`, or other public variables | PASS | Current-tree environment/config search. |
| No secrets hardcoded in current JS/TS/JSON/SQL/HTML/config/test/log/build/doc files | PASS | Secret-safe current-tree scan; tests use explicit dummy placeholder strings. |
| Real `.env` files are ignored | PASS | `.gitignore:3-5`; `git check-ignore`; only examples are tracked. |
| `.env.example` contains placeholders only | PASS | Both tracked example files inspected. |
| Production credentials absent from current Git tree | PASS | `git ls-files` and content scan. |
| Sensitive service/private credentials absent from Git history | PASS | Service-role/private-key/database credential history scan found none. Historical anon publishable key is SEC-019. |
| Existing built frontend bundles exclude active backend-only credential | PASS | Active service-role value compared in memory; zero matches. A fresh build was not run because audit-only scope prohibited changing build output. |
| Logs never expose secrets/tokens/headers/cookies | PARTIAL | No intentional logging found, but raw 5xx error objects are logged (SEC-016); production logs were unavailable. |
| Service role restricted to explicitly privileged operations | FAIL | It is used for every backend repository operation (SEC-003). |

### Authentication and backend authorization

| Control | Status | Evidence/qualification |
|---|---|---|
| Protected endpoints validate an access token | PASS | Route middleware inventory; `authenticate.js:7-15`; unit tests. |
| Identity derives from verified token, not request-body `user_id` | PASS | Verified `sub` only; authorization unit test passes. |
| Tenant/role/membership derive from database context | PASS | `get_request_access_context`; tests reject caller-selected tenant. |
| Approval status enforced on business endpoints | PASS | Home/Owner/Platform guards and tests. `/access/*` intentionally returns account state. |
| Suspended/rejected/deleted accounts blocked | FAIL | Business guards block them, but invitation acceptance can overwrite Employee status and reactivate access (SEC-020). |
| Employee/Owner/Platform Admin permissions enforced server-side | PASS | Route guards and authorization tests. SEC-005 identifies a potentially overbroad Employee business permission. |
| Platform Admin does not rely only on runtime email check | PARTIAL | Runtime uses `platform_admins`; bootstrap migration uses fixed email (SEC-015). |
| Owners cannot select another tenant through header | PASS | Access-context function and unit test. Full live matrix is NOT TESTED. |
| Employees cannot promote themselves | PASS | No employee role/profile write route; authenticated DB writes revoked in migration source. |
| Employees cannot access Owner analytics/settings/invitations/admin | PASS | Owner middleware on dashboard/business/employees/station-write; tests. |
| Owners cannot access Platform Admin routes | PASS | Database-backed admin guard. |
| Object ownership checked for reads/updates/deletes | PARTIAL | Tenant predicates are consistent; Employees can edit any open tenant session (SEC-005); completed-session hard delete is SEC-001. |
| Endpoints reject client-provided tenant identity | PASS | Controllers use `request.auth.businessId`; `X-Business-Id` is treated as a requested context and membership-resolved. |
| Privileged endpoint calls without required role fail | PASS | Static middleware and unit tests; complete deployed HTTP matrix remains NOT TESTED. |

### Supabase RLS, grants, functions, storage

| Control | Status | Evidence/qualification |
|---|---|---|
| RLS enabled on every application table in migration source | PASS | All nine application tables are enabled. Runtime catalog NOT TESTED. |
| Final SELECT policies restrict tenant membership/role/status | PASS | Final policies at migration `004:273-309`. |
| Final authenticated INSERT/UPDATE/DELETE policies are not broad | PASS | Broad migration-001 policies are dropped; writes revoked at `004:257-269`. |
| No final `USING (true)` or `WITH CHECK (true)` policy | PASS | Migration scan. |
| INSERT/UPDATE prevent tenant/role/admin/status mass assignment for authenticated direct clients | PASS | Authenticated writes revoked. Backend service-role path remains SEC-003. |
| Deleted/rejected/suspended accounts remain blocked | FAIL | Helpers block current state, but invitation acceptance rewrites Employee profile/membership to approved/active (SEC-020). |
| `SECURITY DEFINER` functions use a fixed search path | PASS | Reviewed functions set `search_path=public`. |
| Privileged RPC execute grants are restricted | PASS | Access context, invite accept, session start/end/cancel, analytics, and report reservation are revoked from public/anon/authenticated and granted to service role in final migrations. Runtime NOT TESTED. |
| RPC functions validate caller membership and tenant | PASS | Session/invitation/access functions reviewed; service-only execution. |
| Views/materialized views do not bypass tenant controls | NOT APPLICABLE | No application views found in repository migrations. Runtime catalog NOT TESTED. |
| Storage bucket is private and least-privilege policies exist | PARTIAL | Bucket is private and backend-only by source; no `storage.objects` policies found; service role accesses all objects. Runtime NOT TESTED. |
| Anon/authenticated grants are least privilege | PARTIAL | Source revokes writes and applies SELECT RLS; deployed grants/default privileges were unavailable. |
| Service role is not compensating for missing RLS writes | FAIL | Authenticated writes are revoked and all backend writes use service role (SEC-003). |
| Tenant A/B select/insert/update/delete isolation proven live | NOT TESTED | Requires disposable local/staging project and accounts. |

### Rate limiting and abuse controls

| Control | Status | Evidence/qualification |
|---|---|---|
| Login | NOT TESTED | Browser calls Supabase Auth directly; provider/project limits unavailable. |
| Registration | NOT TESTED | Browser calls Supabase Auth directly. |
| Forgot password | NOT TESTED | Browser calls Supabase Auth directly. |
| Password reset | NOT TESTED | Browser calls Supabase Auth directly. |
| Resend confirmation email | NOT TESTED | No application route found; Supabase setting unavailable. |
| Invitation creation | PARTIAL | Broad API limit only; no action/user/tenant-specific shared limiter. |
| Invitation acceptance | PARTIAL | Broad API limit only. |
| Invitation resend/revoke | PARTIAL | Broad API limit only. |
| Platform approval/rejection/removal | PARTIAL | Broad API limit only. |
| PDF generation | PARTIAL | 2/minute tenant limiter plus monthly quota and local concurrency gate; store is process-local. |
| PDF download | PARTIAL | 30/minute tenant limiter; process-local. |
| Expensive analytics | PARTIAL | Broad limit; unbounded chart range (SEC-010). |
| Destructive endpoints | PARTIAL | Broad limit only. |
| Repeated Start/End/Pause/Resume/Cancel | PARTIAL | Broad limit only; some atomic RPCs. |
| Correct reverse-proxy client IP | NOT TESTED | Production defaults to one trusted hop; real Railway/Vercel/Netlify topology unavailable. |
| Forwarding-header bypass prevented | NOT TESTED | Requires request through production-equivalent proxy. |
| Rate-limit status/message | PASS | Middleware returns safe JSON with standard `429`; unit test passes. |
| Limits permit normal use | NOT TESTED | No representative workload test. |
| Distributed deployments use shared store | FAIL | No store configured; default in-process memory (SEC-007). |

### Input inventory

| Input source/category | Validation status | Evidence/notes |
|---|---|---|
| URL IDs: user, invitation, session, report | PASS | UUID validation in feature validators. Station IDs intentionally allow bounded legacy text. |
| URL enum params: dashboard period/granularity | PASS | Strict allowlists. |
| Query dates/periods/limits | PARTIAL | ISO/calendar checks and session limit max 100; chart date span unbounded (SEC-010). |
| JSON bodies | PARTIAL | 256 KB global cap; feature validators construct allowlisted output; station count/nested timestamps have gaps (SEC-017). |
| `Authorization` header | PASS | Strict Bearer shape and token verification. |
| `X-Business-Id` header | PARTIAL | Membership-resolved but malformed UUID reaches RPC (SEC-017). |
| Origin header | PASS | Exact parsed allowlist; also used only if present in configured origins for invitation redirect. |
| Cookies | NOT APPLICABLE | Application does not use backend cookie authentication. Supabase client storage is browser-managed. |
| Uploaded files/filenames | NOT APPLICABLE | No user-upload endpoint found. PDF filename/path are server-generated. |
| Search fields | PARTIAL | No general search endpoint; invitation email `.ilike` leaves wildcard semantics (SEC-017). |
| Notes/descriptions/report titles | PASS | Report title/notes length-bound and escaped. No general session notes field found. |
| Prices/exchange rates | PASS | Hourly rate finite, non-negative, max 999. Currency is tenant data, not an arbitrary exchange-rate input. |
| Dates/times/time zones | PARTIAL | Session/report dates validated and timezone comes from business; station sync timestamps are not validated. |
| Pagination | PARTIAL | Completed sessions max 100; platform fixed max; dashboard loads all matching rows (SEC-010). |
| Sorting | PASS | No caller-selected raw database column; enums/known order are used. |
| Tenant/user/session IDs | PARTIAL | UUIDs and authenticated tenant context used; legacy station IDs and header issue documented. |
| Invitation tokens | PASS | String length 32-512, then hashed; exact 32-byte generation. |
| Role/approval/admin fields | PASS | Backend allowlists actions and does not mass-assign request objects. |

### Input validation and error behavior

| Control | Status | Evidence/qualification |
|---|---|---|
| Missing, malformed, unexpected, oversized values rejected or stripped | PARTIAL | Most validators build new objects and body cap is 256 KB; SEC-017 gaps. |
| UUIDs validated | PARTIAL | Main object IDs yes; `X-Business-Id` no; station IDs intentionally legacy text. |
| Dates and time zones validated | PARTIAL | Date validators and configured business timezone; station timestamps/date-span gaps. |
| Prices finite/non-negative/bounded | PASS | Session/station validators. |
| Controller count integer range | PASS | 1-99; PlayStation-only service checks. |
| Pagination maximum | PARTIAL | Completed sessions yes; chart aggregation no bound. |
| Sorting allowlist | PASS | No raw caller column interpolation found. |
| Sensitive fields cannot be mass-assigned | PARTIAL | Validators strip them; station live-state fields are intentionally accepted (SEC-002). |
| Upload size/type/extension/auth checks | NOT APPLICABLE | No user upload surface. Server-generated PDF bucket limits PDF to 10 MB. |
| Production errors hide stacks/SQL/internal paths/secrets | PARTIAL | Non-operational 500 message is generic; raw error logs and operational details need hardening. |

### XSS and output encoding

| Control | Status | Evidence/qualification |
|---|---|---|
| React avoids unsafe HTML rendering | PASS | No `dangerouslySetInnerHTML` or application `innerHTML` use found. |
| Lounge/user/station/session/error text is React-escaped | PASS | Rendered as JSX text. Stored live behavior NOT TESTED. |
| Unsafe URL schemes rejected | NOT APPLICABLE | No user-controlled link destination field found. |
| Stored XSS remains inert after refresh | NOT TESTED | Requires disposable staging records. Static React behavior is favorable. |
| Report/PDF content escapes untrusted text | PASS | `escapeHtml` applied to business name, title, notes, labels, tables, SVG titles; unit test passes. |
| Invitation content does not render attacker HTML | PASS | Provider template receives email/redirect; app UI renders React text. Provider email template unavailable. |
| Search/error reflections are escaped | PASS | React text and JSON responses; no HTML error response. |
| Logs/admin pages do not execute stored payloads | PARTIAL | Admin page is React-safe; external log viewer behavior unavailable. |
| Content Security Policy | NOT IMPLEMENTED | SEC-013. |
| Harmless payload test suite | PARTIAL | PDF escaping unit test covers script/HTML; full stored browser matrix NOT TESTED. |

### SQL and query manipulation

| Control | Status | Evidence/qualification |
|---|---|---|
| Supabase query builder/parameterized RPCs used | PASS | Repository and SQL review. |
| Raw SQL does not concatenate request input | PASS | No runtime raw SQL execution or string-concatenated SQL found. |
| Dynamic sort/filter/table/column names allowlisted | PASS | No caller table/column; enums and fixed columns. |
| `%`/`_` wildcard behavior is controlled | PARTIAL | General data access remains tenant-scoped; invitation duplicate email uses unescaped `.ilike` (SEC-017). |
| RPC input preserves tenant isolation | PASS | Static RPC review. Runtime multi-account test NOT TESTED. |
| SQL-like text is treated as data | PASS | Query builder/parameters; no destructive SQL was run. |
| Detailed database errors hidden from clients | PARTIAL | Unknown production 500s are generic; selected operational error details may be returned and raw objects logged. |
| Destructive SQL payload tests executed | NOT APPLICABLE | Prohibited; harmless SQL-like strings are sufficient and no raw SQL sink exists. |

### Employee invitation lifecycle

| Control | Status | Evidence/qualification |
|---|---|---|
| Cryptographically secure token | PASS | `randomBytes(32)` base64url. |
| Raw token not stored | PASS | SHA-256 hash stored. |
| Clear expiration | PASS | 72 hours. |
| One-time use | PASS | Pending status + row lock + used transition. |
| Atomic consumption | PASS | `SELECT ... FOR UPDATE` in one RPC; unit tests. |
| Used/expired/revoked/replaced rejected | PASS | RPC/service mappings; live race test NOT TESTED. |
| Tokens absent from application logs | PARTIAL | No token log statement; URL/edge/provider logs unavailable (SEC-008). |
| Token absent from analytics/referrer/unnecessary URL persistence | FAIL | Query-string delivery and delayed scrubbing (SEC-008). |
| Only authorized Owner can create/revoke own invitations | PASS | Owner middleware and authenticated business scope. |
| Owner cannot invite into another tenant | PASS | Business ID comes from auth context. |
| Invitee cannot change tenant/role | PASS | Atomic RPC takes tenant/role from invitation and assigns only Employee. |
| Invitation cannot assign Platform Admin | PASS | Fixed Employee role and account-type conflict check. |
| Resend manages old token safely | PARTIAL | Rotation invalidates old token, but occurs before successful delivery (SEC-018). |
| Acceptance avoids unrelated-account enumeration | PASS | Errors concern supplied token/current account; provider behavior NOT TESTED. |
| Supabase Auth password practices followed | PARTIAL | Invite/recovery flows use Supabase; password policy/dashboard settings unavailable. |
| Owner never receives/stores plaintext employee password | PASS | Employee chooses password; no password field in owner API. |
| Password never emailed | PASS | No plaintext password handling/email found. |
| Email match enforced | PASS | Case-insensitive invited/current email comparison in atomic RPC. |
| Suspended/deleted/rejected profile state cannot be cleared by acceptance | FAIL | RPC unconditionally sets existing Employee profile approved and membership active (SEC-020). |
| Revocation authorized and one-way | PASS | Owner-scoped pending-only update. |
| Token leakage/race/account-takeover review | PARTIAL | Consumption race is handled; URL exposure remains SEC-008. |

### Safe deletion and lifecycle

| Control | Status | Evidence/qualification |
|---|---|---|
| Employee removal authenticated/authorized | PASS | Owner-only, tenant-scoped soft removal. |
| User removal authenticated/authorized | PASS | Platform Admin-only; no self-removal; platform admins excluded from managed profiles. |
| Owner/tenant deletion | PARTIAL | Platform soft removal exists; complete lifecycle absent (SEC-012). |
| Station deletion | PARTIAL | Owner-only soft archive preserves history; concurrency/integrity flaw SEC-002. |
| Session deletion | FAIL | Completed financial rows hard-deleted without audit (SEC-001). |
| Explicit confirmation for sensitive deletion | PARTIAL | Platform UI confirms; API cannot depend on UI; session hard-delete API has no confirmation contract. |
| Cross-tenant deletion blocked | PASS | Static business predicates/context; live matrix NOT TESTED. |
| Employee cannot delete Owner/tenant | PASS | No such route; Owner management guard. |
| Owner cannot delete Platform Admin | PASS | Platform route only; managed-user service rejects admin account type. |
| Self-deletion rules intentional | PARTIAL | Platform admin self-removal denied; Owner/Employee self-deletion not implemented/documented. |
| Tenant deletion avoids accessible orphans | PARTIAL | Status guards block application access; Auth/storage lifecycle incomplete. |
| Cascades avoid unintended shared/financial deletion | PARTIAL | FK map reviewed; no live disposable deletion test; business hard delete would cascade sessions/reports. |
| Soft deletion used where audit/recovery/history required | FAIL | Completed session hard delete; other user/business paths soft-mark state. |
| Soft-deleted accounts cannot regain business API access | FAIL | Guards block deleted state, but Auth user remains and a valid Employee invite can reactivate it (SEC-020). |
| Supabase Auth and profile consistency | PARTIAL | Auth user remains enabled after app soft deletion. |
| Storage handled safely | PARTIAL | Report failure cleanup exists; tenant/user purge reconciliation absent. |
| Deletion transactional/recoverable | FAIL | Platform removal sequential; session delete permanent; no documented recovery. |
| Repeated deletion idempotent | PARTIAL | Soft status updates mostly settle; formal response semantics/tests absent. |
| Audit records initiator/time without secrets | PARTIAL | Platform/employee changes audited; session/station deletion not. |
| Backup and restore before permanent tenant deletion | NOT IMPLEMENTED | No procedure/evidence found. |

### CORS and security headers

| Control | Status | Evidence/qualification |
|---|---|---|
| Exact trusted production/development origins | PASS | Parsed exact origins; no substring matching. Production requires values. |
| Production wildcard absent | PASS | No `*` origin; credentials not enabled. |
| Attacker subdomains/null origins rejected | PASS | Exact membership; no `null` allowance. |
| Methods/headers minimal | PASS | Only used methods and `Authorization`, `Content-Type`, `X-Business-Id`. |
| Credentials enabled only if needed | PASS | No `Access-Control-Allow-Credentials`; bearer header used. |
| Preflight works | PASS | OPTIONS/method unit test. |
| Unauthorized origins receive no CORS permission | PASS | No ACAO for disallowed origin. |
| WebSocket/realtime equivalent controls | NOT APPLICABLE | No application WebSocket/realtime usage found. |
| Content-Security-Policy | NOT IMPLEMENTED | SEC-013. |
| X-Content-Type-Options | PASS | Netlify + Helmet. |
| Referrer-Policy | PASS | Netlify strict-origin-when-cross-origin; invitation callback should be stricter. |
| Permissions-Policy | PASS | Netlify disables camera/microphone/geolocation. |
| HSTS in production | NOT TESTED | Not explicit in repository; hosting defaults unavailable. |
| Frame protection | PASS | Netlify `X-Frame-Options: DENY`; Helmet backend. CSP `frame-ancestors` absent. |

### Console, logging, and errors

| Control | Status | Evidence/qualification |
|---|---|---|
| Passwords not logged | PASS | No logging sink found. Production observation unavailable. |
| Access/refresh tokens and Authorization headers not logged | PASS | No header/token logger found; raw provider-error caveat SEC-016. |
| Cookies not logged | PASS | No cookie logging found. |
| Service-role/anon keys not logged | PASS | No environment/key logging found. |
| Invitation tokens/reset links not logged | PARTIAL | No app statement; URLs may reach edge/provider logs (SEC-008). |
| Full sensitive request bodies not logged | PASS | No request-body logger. |
| Database connection strings not logged | PASS | No logger. |
| Production responses hide stack traces | PASS | Generic non-operational 500; no stack response. |
| SQL/provider errors hidden | PARTIAL | Client response generally generic; raw server logging and operational details remain. |
| Frontend debug statements safe/removed | PASS | No unsafe production credential/body logging found. |
| Structured logging fields implemented | NOT IMPLEMENTED | Uses `console.error(error)`, no request IDs/event schema. |
| PII minimized and retention documented | NOT TESTED | Audit metadata includes invitation email; external log retention unavailable. |

## 6. Authorization and RLS matrix

### Backend authorization matrix

Legend: `2xx` allowed; `401` unauthenticated; `403` role/status/context denied; `404` tenant-scoped object hidden/not found; `T` depends on a valid invitation matching the current authenticated account; `own draft` is the only Employee delete case. “Actual” is source/test evidence unless explicitly marked live.

| Endpoint(s) | Method | Unauth | Pending Owner | Active Owner | Employee | Suspended | Platform Admin | Cross-tenant attempt | Expected | Actual |
|---|---|---:|---:|---:|---:|---:|---:|---|---|---|
| `/api/access/me` | GET | 401 | 2xx state | 2xx | 2xx | 2xx state | 2xx state | Context denied/no tenant | Authenticated state lookup | PASS, unit/static |
| `/api/access/password-configured` | POST | 401 | 2xx | 2xx | 2xx | 2xx | 2xx | N/A | Only after verified password change | **FAIL**, SEC-006 |
| `/api/platform/owners`, `/users`, `/audit-logs` | GET | 401 | 403 | 403 | 403 | 403 | 2xx | Platform-wide by design | Admin only | PASS, unit/static |
| `/api/platform/owners/:id/status`, `/users/:id`, `/users/:id/status` | PATCH | 401 | 403 | 403 | 403 | 403 | 2xx | Platform-wide by design | Admin only; no self/admin target abuse | PASS, unit/static; transaction issue SEC-009 |
| `/api/platform/users/:id` | DELETE | 401 | 403 | 403 | 403 | 403 | 2xx | Platform-wide by design | Admin only; no self/admin deletion | PASS auth; lifecycle SEC-012 |
| `/api/employees/invitations/accept` | POST | 401 | T/account conflict | T/account conflict | T | **T; reactivates** | T/account conflict | Token fixes tenant | Auth + valid invite without clearing platform suspension/deletion | **FAIL**, SEC-020 |
| `/api/employees`, `/invitations` | GET | 401 | 403 | 2xx | 403 | 403 | 403 | 403/empty | Active Owner own tenant | PASS, unit/static |
| `/api/employees/invitations` | POST | 401 | 403 | 201 | 403 | 403 | 403 | 403 | Active Owner own tenant | PASS auth; rate issue SEC-007 |
| `/api/employees/invitations/:id/resend` | POST | 401 | 403 | 2xx | 403 | 403 | 403 | 404 | Active Owner own tenant | PASS auth; SEC-018 |
| `/api/employees/invitations/:id` | DELETE | 401 | 403 | 2xx | 403 | 403 | 403 | 404 | Active Owner own tenant | PASS, unit/static |
| `/api/employees/:userId/status` | PATCH | 401 | 403 | 2xx | 403 | 403 | 403 | 404 | Active Owner, Employee in own tenant only | PASS, tenant unit test |
| `/api/stations` | GET | 401 | 403 | 2xx | 2xx | 403 | 403 | 403/context or empty | Active Home role own tenant | PASS static |
| `/api/stations` | PUT | 401 | 403 | 2xx | 403 | 403 | 403 | 403/conflict | Active Owner own tenant | PASS role; **FAIL integrity**, SEC-002 |
| `/api/sessions`, `/start` | POST | 401 | 403 | 201 | 201 | 403 | 403 | 403/404 | Active Home role own station | PASS atomic combined start; legacy SEC-004 |
| `/api/sessions/active`, `/activity/today`, `/:id` | GET | 401 | 403 | 2xx | 2xx open rows | 403 | 403 | 404/empty | Active Home role, own tenant | PASS static; cancellation cross-tenant unit test |
| `/api/sessions/completed` | GET | 401 | 403 | 2xx | 403 | 403 | 403 | 404/empty | Active Owner own tenant | PASS static |
| `/api/sessions/:id/start`, `/pause`, `/resume` | POST | 401 | 403 | 2xx | 2xx | 403 | 403 | 404 | Active Home role own open session | PASS auth; transaction SEC-004 |
| `/api/sessions/:id` | PATCH | 401 | 403 | 2xx | 2xx any open | 403 | 403 | 404 | Documented operator policy | **PARTIAL**, SEC-005 |
| `/api/sessions/:id/cancel`, `/end` | POST | 401 | 403 | 2xx | 2xx | 403 | 403 | 403/404 | Active Home role; atomic own tenant | PASS static/unit |
| `/api/sessions/:id` | DELETE | 401 | 403 | 204 | own draft | 403 | 403 | 404 | No unaudited completed-history deletion | **FAIL**, SEC-001 |
| `/api/dashboard/summary/:period`, `/charts/:granularity` | GET | 401 | 403 | 2xx | 403 | 403 | 403 | 403/empty | Active Owner own tenant | PASS auth; range SEC-010 |
| `/api/business/daily`, `/monthly`, `/yearly` | GET | 401 | 403 | 2xx | 403 | 403 | 403 | 403/empty | Active Owner own tenant | PASS static/unit |
| `/api/business/reports`, `/reports/:id/pdf` | GET | 401 | 403 | 2xx | 403 | 403 | 403 | 404 | Active Owner own tenant | PASS static/unit |
| `/api/business/reports/pdf` | POST | 401 | 403 | 201 | 403 | 403 | 403 | 403 | Active Owner own tenant + quota | PASS auth/unit; sandbox SEC-014 |

### Final migration-source RLS matrix

This is the expected state after all repository migrations are applied in order. The deployed catalog was not available.

| Table | RLS | Anon | Authenticated SELECT | Authenticated INSERT | Authenticated UPDATE | Authenticated DELETE | Backend service role |
|---|---|---|---|---|---|---|---|
| `profiles` | Enabled | Deny | Own row or Platform Admin | Deny | Deny | Deny | Bypass |
| `platform_admins` | Enabled | Deny | Platform Admin | Deny | Deny | Deny | Bypass |
| `businesses` | Enabled | Deny | Platform Admin or active member | Deny | Deny | Deny | Bypass |
| `business_members` | Enabled | Deny | Platform Admin, self, or approved Owner of business | Deny | Deny | Deny | Bypass |
| `stations` | Enabled | Deny | Approved Owner or active Employee | Deny | Deny | Deny | Bypass |
| `sessions` | Enabled | Deny | Approved Owner all tenant rows; active Employee only draft/active/paused | Deny | Deny | Deny | Bypass |
| `employee_invitations` | Enabled | Deny | Platform Admin or approved Owner | Deny | Deny | Deny | Bypass |
| `admin_audit_logs` | Enabled | Deny | Platform Admin or approved Owner for business | Deny | Deny | Deny | Bypass |
| `business_report_exports` | Enabled | Deny | No policy | Deny | Deny | Deny | Bypass |

### Role/action summary

| Sensitive action | Pending Owner | Active Owner | Employee | Suspended | Platform Admin | Tenant A against Tenant B |
|---|---:|---:|---:|---:|---:|---:|
| Operate stations/sessions | Deny | Allow | Allow | Deny | Deny | Deny by context/predicate |
| Configure/archive stations | Deny | Allow | Deny | Deny | Deny | Deny |
| View completed sessions/revenue | Deny | Allow | Deny | Deny | Deny | Deny |
| Manage employees/invitations | Deny | Allow | Deny | Deny | Deny | Deny |
| View dashboard/analytics/reports | Deny | Allow | Deny | Deny | Deny | Deny |
| Approve/suspend/remove platform users | Deny | Deny | Deny | Deny | Allow | Platform-wide by design |
| Change own tenant/role/admin status directly | Deny | Deny | Deny | Deny | No self-change through managed API | Deny by write grants/context |

## 7. Test results

All tests were non-destructive and executed against the local source/worktree. No HTTP mutation was sent to production or Supabase.

| Test name | Environment | Input category | Expected result | Actual result | Result | Evidence |
|---|---|---|---|---|---|---|
| Backend Node test suite | Local Node, mocked repositories/config | Auth, authorization, analytics, invitations, CORS, rate limits, sessions, station sync, time zones, PDF | All existing cases pass | 94 passed, 0 failed, 0 skipped | PASS | `cd backend && npm test`; duration 1.386 s |
| Frontend Node test suite | Local Node | Auth messages, analytics formatting, request coalescing, cancellation, time zones, station persistence, env config | All existing cases pass | 30 passed, 0 failed, 0 skipped | PASS | `cd frontend && npm test`; duration 0.511 s |
| Backend production dependency audit | npm registry metadata, backend lockfile | Known dependency advisories | No known vulnerability | 0 critical/high/moderate/low/info across 223 dependencies | PASS | `npm audit --omit=dev --json`, 2026-08-30 |
| Frontend production dependency audit | npm registry metadata, frontend lockfile | Known dependency advisories | No known vulnerability | 0 critical/high/moderate/low/info across 151 dependencies | PASS | `npm audit --omit=dev --json`, 2026-08-30 |
| Tracked environment-file test | Local Git index | Credential file paths | Real `.env` untracked; examples only | Only `backend/.env.example`, `frontend/.env.example` tracked | PASS | `git ls-files`; `.gitignore:3-5` |
| Current-tree secret-pattern test | Local current tree | Service keys, JWTs, private keys, DB URLs, common secret assignments | No complete secret in tracked content | No real private/service credential found; placeholders/name references only | PASS | Secret-safe content scan; actual values never printed |
| Active service-role exposure test | Local source and existing build output | Exact active backend key, compared in memory | Zero frontend/build matches | Zero matches | PASS | `frontend/src`, `frontend/dist`, root `dist` comparison; value redacted |
| Git-history credential test | Local Git object history | Service-role assignments, JWT role claim classification, `.env` paths | No secret/service credential; report public historical key separately | No service-role history; two historical anon publishable-key example commits | PASS | SEC-019; values redacted |
| Unsafe React HTML sink search | Local source | XSS sinks | No uncontrolled HTML sink | No `dangerouslySetInnerHTML`; no application `innerHTML` sink | PASS | Static source search |
| PDF harmless XSS escaping | Local backend unit test | Script/image/SVG-style owner content | Payload encoded, not executable | Existing “report HTML escapes owner content” case passed | PASS | Backend test output; `business-report.template.js:45,371-378` |
| Raw SQL/string-concatenation sink search | Local source | SQL-like input paths | Parameterized/query-builder operations only | No runtime raw SQL execution or request-concatenated SQL found | PASS | Repository/SQL static review |
| Final migration policy scan | Local migrations | RLS, grants, `USING`, `WITH CHECK`, function security | RLS on; no broad final writes; safe function search paths | Expected final source state documented in matrix | PASS (source only) | Migrations `001`-`016`; runtime is blocked |
| Protected route middleware inventory | Local Express source | Unauthenticated/role route boundary | All sensitive routes authenticated and role-guarded as designed | No unguarded sensitive route found; exceptions documented | PASS | All `*.routes.js`; authorization matrix |
| Token-derived identity unit cases | Local backend tests | Forged role/tenant/email/malformed bearer | Reject forged/invalid identity | Cases for DB membership, caller-selected tenant, email-only admin, invalid token passed | PASS | Backend test names in runner output |
| Cross-tenant cancellation unit case | Local backend tests | Tenant A context with unauthorized/cross-tenant object | No state mutation | Cross-tenant/unauthorized/database-failed cancellation preserved station state | PASS | Backend test output |
| Invitation cryptography/atomic-result unit cases | Local backend tests | Raw token, duplicate, expired, used, wrong provider state | Hash-only storage and safe rejection | Hash, duplicate, expired, already-used, tenant-scoping, delivery cases passed | PASS | Backend test output |
| Suspended/deleted invitation-acceptance case | Local source review | Existing Employee profile in platform-blocked state | RPC must reject and preserve status | No existing unit case; SQL overwrites status to approved/active | FAIL | Migration `008:29-75`; SEC-020 |
| CORS/config unit cases | Local backend tests | Origins, URL paths, methods, proxy-hop values | Exact origins; valid methods; unsafe config rejected | All relevant cases passed | PASS | Backend test output |
| Rate-limit response unit cases | Local backend tests | Limit exceeded | Safe `429` JSON and tenant isolation for PDF | Global and PDF limiter cases passed | PASS | Backend test output |
| Session transition and validation unit cases | Local backend tests | Future times, invalid states/counts, pause/cancel/end | Safe validation and state results | All existing session cases passed | PASS | Backend test output |
| Station sync unit cases | Local backend tests | Archive with live session, legacy/unsafe IDs, empty list | Refuse known live row; accept safe formats | Existing sequential cases passed; concurrency race not covered | PARTIAL | Backend test output; SEC-002 |
| Worktree mutation check before report | Local Git worktree | Audit-only constraint | No pre-existing/new source edits from tests | Clean before `SECURITY_AUDIT.md` creation | PASS | `git status --short` |

Important coverage note: passing unit tests verify implemented behavior, not the deployed Supabase catalog or a real multi-tenant attack matrix. There are no live integration tests in this result.

## 8. Blocked tests

| Blocked test | Why it was not executed | Needed access/data | Exact safe test once available |
|---|---|---|---|
| Deployed RLS/policy/grant catalog | No local/staging Supabase connection or read-only auditor credential was provided | Disposable local/staging project; read-only catalog access | Query `pg_class.relrowsecurity`, `pg_policies`, table/routine grants, function `prosecdef/proconfig`, exposed schemas, views, and storage policies; compare to the RLS matrix. Do not change policies. |
| Full Tenant A/Tenant B RLS isolation | No staged users/tokens/disposable rows | A Owner/Employee, B Owner/Employee, Platform Admin, pending and suspended users; disposable records | With each user's publishable/JWT client, attempt SELECT by Tenant B IDs. For INSERT/UPDATE/DELETE, use disposable rows inside a transaction/rollback or disposable project. Expect RLS denial/zero rows for every cross-tenant operation. |
| Full backend HTTP authorization matrix | No running staging API/test identities | Same role accounts and API URL | Send each matrix request with no token, each role token, suspended state, and `X-Business-Id` for the other tenant. Compare status/body and verify no data changes except dedicated fixtures. |
| Service-role separation proof | Current design universally uses admin client | Remediated staging build | Log database role name only (never token) in test instrumentation and assert ordinary calls are `authenticated`; verify admin role only on allowlisted operations. |
| Station archive/start concurrency | Mutation could corrupt real data; no disposable staging DB | Disposable station and Employee/Owner tokens | Synchronize two requests with a barrier: Owner removes station while Employee starts. Repeat many times. Assert no archived live station and one valid outcome. Clean only dedicated fixtures. |
| Legacy transition rollback | Requires controlled database fault injection | Disposable staging DB or repository integration harness | Force the station write to fail after a session transition; assert transaction rollback/no split state. |
| Completed-session deletion behavior | Real deletion prohibited | Dedicated completed fixture and backup in disposable staging | Verify current hard delete only to reproduce before fix if explicitly approved; after fix, verify retained row/audit. Never use production revenue records. |
| Tenant/user deletion and cascade/storage map | Real account deletion prohibited | Dedicated disposable tenant with Auth user, member, stations, sessions, invites, report metadata/object | Snapshot all rows/objects, exercise the approved lifecycle, verify access denial, retention, orphan cleanup, audit, idempotency, and restore. |
| Supabase Auth abuse limits | Provider dashboard/settings unavailable; no brute-force testing allowed | Staging Supabase project and disposable email accounts | At low safe volume, verify login/signup/reset/resend thresholds and `429`/provider response; inspect configured quotas. Do not test production. |
| Railway proxy/IP behavior | No deployed staging endpoint or topology | Production-equivalent Railway staging with two replicas | Send requests through proxy with controlled source and forged forwarding headers. Verify `request.ip`, limit grouping, one trusted hop, no spoof bypass, and shared-store enforcement. Log only test request IDs/IP classifications. |
| Production CORS/header behavior | No deployment URL was exercised | Netlify/Vercel frontend and Railway backend staging origins, plus an untrusted origin | Issue preflights and GETs; verify exact ACAO behavior, no credentials wildcard, CSP/HSTS/nosniff/referrer/permissions/frame headers. |
| Stored browser XSS | No staging database/test browser session | Disposable fields for lounge/user/station/report/invitation/error payloads | Store harmless listed payloads, reload all Owner/Employee/Admin views, generate PDF, and confirm no dialog/network/script execution. Remove dedicated fixtures afterward. |
| Invitation URL/log/referrer leakage | Provider/hosting logs and email links unavailable | Staging email, Netlify/Railway logs, analytics console | Use a canary token, open signed-out invite, inspect browser requests/history/referrer, email scanner behavior, hosting and analytics logs; confirm only redacted/absent values. |
| Invitation acceptance for blocked account states | No disposable staged suspended/deleted Employee and valid invite | Staging Owner, suspended/deleted/rejected Employee fixtures, dedicated invites | Attempt acceptance for each state; require `403`, unchanged profile/membership/invite, and safe audit. After remediation, add this as a permanent integration test. |
| Storage isolation | No bucket/catalog access | Staging project and A/B report fixtures | Attempt direct list/download with anon and each tenant JWT; expect denial. Verify backend download checks both business and report ID, and object paths cannot be substituted. |
| Backup/restore readiness | No runbook or backup environment | Documented Supabase backup/PITR configuration and isolated restore target | Restore a recent backup into isolation, verify Auth/application/storage consistency and measured RPO/RTO without touching production. |
| Production logs/redaction | Hosting logs unavailable | Staging Railway/Netlify log access | Trigger safe canary failures containing markers in headers/body/provider errors and confirm no secret/PII markers are retained. |

## 9. Prioritized remediation plan

### Immediate — before any production launch

1. Disable hard deletion of completed sessions and implement an audited correction/void or soft-delete model (SEC-001).
2. Make station synchronization transactional and server-own all live-state fields; close the archive/start race (SEC-002).
3. Separate user-scoped and service-role Supabase clients. Put ordinary tenant access behind RLS or caller-validating RPCs (SEC-003).
4. Prevent invitation acceptance from clearing suspended/deleted/rejected account state and add explicit state-transition tests (SEC-020).
5. Provision a disposable staging Supabase project and execute the complete deployed RLS/grant and Tenant A/B authorization matrices. Treat any cross-tenant success as Critical.
6. Convert every exposed session transition to atomic/idempotent database operations or remove the legacy routes (SEC-004).
7. Make platform approval/removal transitions transactional with audit in the same commit (SEC-009).
8. Add a shared production rate-limit store and endpoint-specific abuse controls; verify the Railway proxy topology (SEC-007).
9. Remove the password-setup assertion bypass and scrub invitation tokens from URLs immediately (SEC-006, SEC-008).

### Short term — next security release

1. Decide and enforce Employee financial-edit permissions with correction audit (SEC-005).
2. Bound/aggregate analytics date ranges and cap station-list inputs (SEC-010, SEC-017).
3. Establish one authoritative migration workflow and fresh-database catalog validation in CI (SEC-011).
4. Implement the user/tenant/Auth/storage deletion and recovery state machine, including backup/restore evidence (SEC-012).
5. Deploy and tune CSP; explicitly verify HSTS and all edge headers (SEC-013).
6. Move PDF rendering to a sandboxed, secret-minimized isolated worker (SEC-014).
7. Replace fixed-email platform bootstrap with an explicit audited UUID grant (SEC-015).
8. Replace raw error logging with structured, allowlisted, redacted events and request IDs (SEC-016).

### Hardening — defense in depth

1. Add continuous secret scanning for current tree and history, with role-aware handling of Supabase publishable keys.
2. Add live staging integration tests for every authorization/RLS matrix cell and every SECURITY DEFINER RPC.
3. Add concurrency/fault-injection tests for invitation, station, report, platform, and session state machines.
4. Add audit events for session and station financial/configuration changes; protect audit retention from tenant mutation.
5. Add security monitoring for repeated auth failures, invitation abuse, destructive operations, cross-tenant denials, quota failures, and administrative changes—without logging bearer data.
6. Document Supabase Auth password, email, session, MFA/admin, rate-limit, redirect, and exposed-schema settings and validate them during deployment.
7. Test private storage isolation, orphan reconciliation, backup restoration, key rotation, and incident response regularly.

## 10. Final launch decision

# NOT SAFE TO LAUNCH

The previously confirmed High-severity defects now have source-level fixes, including protected financial history, atomic station synchronization, caller-JWT/RLS reads, and blocked-account invitation protection. However, the hardening migration has not been applied and verified in disposable staging, and deployed RLS/cross-tenant behavior has not been tested with real role accounts. The staging launch gates in `SECURITY_DEPLOYMENT_CHECKLIST.md` must pass before production launch.

No production database, credential, deployment, or Git history was changed. The current worktree contains approved code, migration, test, dependency, and deployment-configuration remediations; they still require controlled staging rollout and verification.
-






























































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































