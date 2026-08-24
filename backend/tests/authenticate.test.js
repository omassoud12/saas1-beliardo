import test from "node:test";
import assert from "node:assert/strict";
import { createAuthenticate } from "../src/middleware/authenticate.js";

function clientWithMemberships(memberships) {
  return {
    auth: { async getUser() { return { data: { user: { id: "user-1" } }, error: null }; } },
    from() {
      const filters = {};
      const builder = {
        select() { return builder; },
        eq(field, value) { filters[field] = value; return builder; },
        order() { return builder; },
        async limit() {
          return {
            data: memberships.filter((membership) =>
              (!filters.user_id || membership.user_id === filters.user_id)
              && (!filters.business_id || membership.business_id === filters.business_id),
            ).slice(0, 1),
            error: null,
          };
        },
      };
      return builder;
    },
  };
}

async function runMiddleware(middleware, request) {
  return new Promise((resolve) => middleware(request, {}, resolve));
}

test("authentication derives the tenant from verified membership", async () => {
  const client = clientWithMemberships([{
    user_id: "user-1", business_id: "business-a", role: "owner",
    businesses: { id: "business-a", timezone: "Asia/Beirut" },
  }]);
  const request = { headers: { authorization: "Bearer valid-token" } };
  const error = await runMiddleware(createAuthenticate({ getAdminClient: () => client }), request);
  assert.equal(error, undefined);
  assert.equal(request.auth.businessId, "business-a");
  assert.equal(request.auth.timezone, "Asia/Beirut");
});

test("a user cannot select a business without membership", async () => {
  const client = clientWithMemberships([{
    user_id: "user-1", business_id: "business-a", role: "owner",
    businesses: { id: "business-a", timezone: "UTC" },
  }]);
  const request = {
    headers: { authorization: "Bearer valid-token", "x-business-id": "business-b" },
  };
  const error = await runMiddleware(createAuthenticate({ getAdminClient: () => client }), request);
  assert.equal(error.statusCode, 403);
  assert.equal(error.code, "FORBIDDEN");
});
