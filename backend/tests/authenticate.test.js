import test from "node:test";
import assert from "node:assert/strict";
import { createAuthenticate } from "../src/middleware/authenticate.js";
import { requireApprovedOwner } from "../src/middleware/accessGuards.js";

function clientWithAccess({ memberships = [], profileStatus = "approved", platform = false } = {}) {
  return {
    auth: { async getClaims() { return { data: { claims: { sub: "user-1", email: "untrusted-role@example.com", role: "platform_admin" } }, error: null }; } },
    async rpc(_name, { p_business_id: businessId }) {
      const membership = memberships.find((item) => !businessId || item.business_id === businessId);
      const business = Array.isArray(membership?.businesses) ? membership.businesses[0] : membership?.businesses;
      return { data: [{
        profile: { id: "user-1", email: "user@example.com", account_type: "owner", account_status: profileStatus },
        is_platform_admin: platform,
        business_id: membership?.business_id ?? null,
        role: membership?.role ?? null,
        membership_status: membership?.status ?? null,
        business_status: business?.status ?? null,
        timezone: business?.timezone ?? null,
      }], error: null };
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

test("verified JWT identity does not supply email, role, or tenant authorization", async () => {
  const request = { headers: { authorization: "Bearer valid-token" } };
  await run(createAuthenticate({ getAdminClient: () => clientWithAccess({ platform: false }) }), request);
  assert.equal(request.auth.user.id, "user-1");
  assert.equal(request.auth.user.email, "user@example.com");
  assert.equal(request.auth.isPlatformAdmin, false);
  assert.equal(request.auth.role, null);
  assert.equal(request.auth.businessId, null);
});

test("invalid or expired JWTs return a consistent 401", async () => {
  const client = clientWithAccess();
  client.auth.getClaims = async () => ({ data: null, error: new Error("expired") });
  const error = await run(createAuthenticate({ getAdminClient: () => client }), { headers: { authorization: "Bearer expired-token" } });
  assert.equal(error.statusCode, 401);
  assert.equal(error.code, "UNAUTHORIZED");
});

test("verified JWTs without a subject are rejected", async () => {
  const client = clientWithAccess();
  client.auth.getClaims = async () => ({ data: { claims: {} }, error: null });
  const error = await run(createAuthenticate({ getAdminClient: () => client }), { headers: { authorization: "Bearer malformed-token" } });
  assert.equal(error.statusCode, 401);
  assert.equal(error.code, "UNAUTHORIZED");
});

test("missing and malformed bearer headers are rejected before verification", async () => {
  const client = clientWithAccess();
  let verificationCalls = 0;
  client.auth.getClaims = async () => {
    verificationCalls += 1;
    return { data: { claims: { sub: "user-1" } }, error: null };
  };
  for (const authorization of [undefined, "Basic value", "Bearer"] ) {
    const headers = authorization ? { authorization } : {};
    const error = await run(createAuthenticate({ getAdminClient: () => client }), { headers });
    assert.equal(error.statusCode, 401);
    assert.equal(error.code, "UNAUTHORIZED");
  }
  assert.equal(verificationCalls, 0);
});
