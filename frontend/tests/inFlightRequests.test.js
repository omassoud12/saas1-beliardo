import test from "node:test";
import assert from "node:assert/strict";
import { createAuthenticatedRequestKey, createInFlightRequestCache } from "../src/lib/inFlightRequests.js";

test("coalesces concurrent requests with the same key", async () => {
  const cache = createInFlightRequestCache();
  let calls = 0;
  let resolveRequest;
  const factory = () => {
    calls += 1;
    return new Promise((resolve) => { resolveRequest = resolve; });
  };

  const first = cache.run("GET:/stations", factory);
  const second = cache.run("GET:/stations", factory);
  assert.equal(first, second);
  assert.equal(calls, 0);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveRequest({ stations: [] });
  assert.deepEqual(await second, { stations: [] });
});

test("removes fulfilled and rejected requests from the cache", async () => {
  const cache = createInFlightRequestCache();
  let calls = 0;
  const factory = async () => ++calls;
  assert.equal(await cache.run("GET:/access/me", factory), 1);
  assert.equal(await cache.run("GET:/access/me", factory), 2);

  await assert.rejects(cache.run("GET:/stations", async () => { throw new Error("offline"); }), /offline/);
  assert.equal(await cache.run("GET:/stations", factory), 3);
});

test("authenticated request keys isolate users, tenants, and refreshed tokens", () => {
  const baseline = createAuthenticatedRequestKey({ accessToken: "token-a", userId: "user-a", tenantId: "tenant-a", path: "/stations" });
  assert.notEqual(baseline, createAuthenticatedRequestKey({ accessToken: "token-a", userId: "user-b", tenantId: "tenant-a", path: "/stations" }));
  assert.notEqual(baseline, createAuthenticatedRequestKey({ accessToken: "token-a", userId: "user-a", tenantId: "tenant-b", path: "/stations" }));
  assert.notEqual(baseline, createAuthenticatedRequestKey({ accessToken: "token-b", userId: "user-a", tenantId: "tenant-a", path: "/stations" }));
});
