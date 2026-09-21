import test from "node:test";
import assert from "node:assert/strict";
import {
  clearBusinessRequestCache, invalidateBusinessRequestCache, readBusinessRequest,
} from "../src/lib/businessRequestCache.js";

test("Business request cache deduplicates and reuses short-lived tenant-period requests", async () => {
  clearBusinessRequestCache();
  let calls = 0;
  const load = async () => ({ call: ++calls });
  const key = "business:tenant-a:overview:daily:{date:2026-09-21}";
  const [first, second] = await Promise.all([readBusinessRequest(key, load), readBusinessRequest(key, load)]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(await readBusinessRequest(key, load), first);
  assert.equal(calls, 1);
});

test("Business request invalidation is isolated to one tenant", async () => {
  clearBusinessRequestCache();
  let callsA = 0;
  let callsB = 0;
  await readBusinessRequest("business:tenant-a:analysis:monthly:{}", async () => ++callsA);
  await readBusinessRequest("business:tenant-b:analysis:monthly:{}", async () => ++callsB);
  invalidateBusinessRequestCache("tenant-a");
  await readBusinessRequest("business:tenant-a:analysis:monthly:{}", async () => ++callsA);
  await readBusinessRequest("business:tenant-b:analysis:monthly:{}", async () => ++callsB);
  assert.equal(callsA, 2);
  assert.equal(callsB, 1);
});

test("invalidation prevents an older in-flight response from repopulating the cache", async () => {
  clearBusinessRequestCache();
  const key = "business:tenant-a:overview:daily:{}";
  let release;
  let calls = 0;
  const first = readBusinessRequest(key, () => {
    calls += 1;
    return new Promise((resolve) => { release = resolve; });
  });
  await Promise.resolve();
  invalidateBusinessRequestCache("tenant-a");
  release("stale");
  assert.equal(await first, "stale");
  assert.equal(await readBusinessRequest(key, async () => { calls += 1; return "fresh"; }), "fresh");
  assert.equal(calls, 2);
});
