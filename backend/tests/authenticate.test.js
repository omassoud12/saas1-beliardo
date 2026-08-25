import test from "node:test";
import assert from "node:assert/strict";
import { createAuthenticate } from "../src/middleware/authenticate.js";
import { requireApprovedOwner } from "../src/middleware/accessGuards.js";

function clientWithAccess({ memberships = [], profileStatus = "approved", platform = false } = {}) {
  return {
    auth: { async getUser() { return { data: { user: { id: "user-1", email: "user@example.com" } }, error: null }; } },
    from(table) {
      const filters = {};
      const builder = {
        select() { return builder; }, eq(field, value) { filters[field] = value; return builder; },
        neq() { return builder; }, order() { return builder; },
        async maybeSingle() {
          if (table === "profiles") return { data: { id: "user-1", email: "user@example.com", account_type: "owner", account_status: profileStatus }, error: null };
          if (table === "platform_admins") return { data: platform ? { user_id: "user-1" } : null, error: null };
          return { data: null, error: null };
        },
        async limit() { return { data: memberships.filter((item) => (!filters.user_id || item.user_id === filters.user_id) && (!filters.business_id || item.business_id === filters.business_id)).slice(0, 1), error: null }; },
      };
      return builder;
    },
  };
}
const run = (middleware, request) => new Promise((resolve) => middleware(request, {}, resolve));

test("authentication derives role and tenant only from verified database membership", async () => {
  const client = clientWithAccess({ memberships: [{ user_id: "user-1", business_id: "business-a", role: "owner", status: "active", businesses: { id: "business-a", timezone: "Asia/Beirut", status: "approved" } }] });
  const request = { headers: { authorization: "Bearer valid-token" } };
  assert.equal(await run(createAuthenticate({ getAdminClient: () => client }), request), undefined);
  assert.equal(request.auth.businessId, "business-a");
  assert.equal(request.auth.role, "owner");
  assert.equal(request.auth.timezone, "Asia/Beirut");
});

test("a caller cannot select a tenant without membership", async () => {
  const client = clientWithAccess({ memberships: [{ user_id: "user-1", business_id: "business-a", role: "owner", status: "active", businesses: { id: "business-a", timezone: "UTC", status: "approved" } }] });
  const request = { headers: { authorization: "Bearer valid-token", "x-business-id": "business-b" } };
  await run(createAuthenticate({ getAdminClient: () => client }), request);
  assert.equal(request.auth.businessId, null);
  assert.equal((await run(requireApprovedOwner, request)).statusCode, 403);
});

test("email alone never grants platform administrator access", async () => {
  const request = { headers: { authorization: "Bearer valid-token" } };
  await run(createAuthenticate({ getAdminClient: () => clientWithAccess({ platform: false }) }), request);
  assert.equal(request.auth.isPlatformAdmin, false);
});
