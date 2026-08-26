import test from "node:test";
import assert from "node:assert/strict";
import { requireApprovedOwner, requireHomeAccess, requirePlatformAdmin } from "../src/middleware/accessGuards.js";
import { getAccessState } from "../src/features/access/access.service.js";

const run = (guard, access) => new Promise((resolve) => guard({ auth: access }, {}, resolve));
const auth = ({ profile = {}, ...values } = {}) => ({ profile: { id: "u1", email: "u@x.test", account_type: "owner", account_status: "approved", ...profile }, isPlatformAdmin: false, role: "owner", membershipStatus: "active", businessStatus: "approved", businessId: "b1", timezone: "UTC", ...values });

test("approved owner receives full tenant permissions", () => { const result = getAccessState(auth()); assert.equal(result.state, "approved_owner"); assert.equal(result.permissions.manageEmployees, true); });
test("active employee receives Home permissions only", () => { const result = getAccessState(auth({ role: "employee", profile: { account_type: "employee" } })); assert.equal(result.state, "active_employee"); assert.equal(result.permissions.operateSessions, true); assert.equal(result.permissions.viewAnalytics, false); });
test("pending owner is blocked from tenant routes", async () => { const error = await run(requireApprovedOwner, auth({ profile: { account_status: "pending_approval" }, businessStatus: "pending_approval" })); assert.equal(error.code, "PENDING_APPROVAL"); });
test("employee is blocked from owner routes", async () => { const error = await run(requireApprovedOwner, auth({ role: "employee", profile: { account_type: "employee" } })); assert.equal(error.statusCode, 403); });
test("employee is allowed through Home operations guard", async () => { assert.equal(await run(requireHomeAccess, auth({ role: "employee", profile: { account_type: "employee" } })), undefined); });
test("platform access requires a database-backed admin flag", async () => { assert.equal((await run(requirePlatformAdmin, auth())).statusCode, 403); assert.equal(await run(requirePlatformAdmin, auth({ isPlatformAdmin: true, businessId: null, role: null })), undefined); });
test("employee password setup persists as a blocked access state", () => { const result = getAccessState(auth({ role: "employee", profile: { account_type: "employee", requires_password_setup: true } })); assert.equal(result.state, "password_setup_required"); assert.equal(result.profile.requiresPasswordSetup, true); assert.equal(result.permissions.operateSessions, false); });
test("employee cannot call Home APIs before password setup completes", async () => { const error = await run(requireHomeAccess, auth({ role: "employee", profile: { account_type: "employee", requires_password_setup: true } })); assert.equal(error.code, "PASSWORD_SETUP_REQUIRED"); });
