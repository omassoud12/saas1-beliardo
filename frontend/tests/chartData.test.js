import test from "node:test";
import assert from "node:assert/strict";
import { buildConcurrencyBuckets, buildRevenueSeries, normalizeActivityType } from "../src/utils/chartData.js";
import { formatCurrency } from "../src/utils/analytics.js";

const period = { from: "2026-08-24T00:00:00.000Z", to: "2026-08-24T03:00:00.000Z", timezone: "UTC" };

test("activity aliases normalize without silently accepting unknown values", () => {
  assert.equal(normalizeActivityType("PS5"), "playstation");
  assert.equal(normalizeActivityType("pool"), "billiard");
  assert.equal(normalizeActivityType("table_tennis"), "pingpong");
  assert.equal(normalizeActivityType("arcade"), "unknown");
});

test("concurrency clips sessions crossing the selected period", () => {
  const rows = buildConcurrencyBuckets([{ activity: "playstation", status: "completed", startedAt: "2026-08-23T23:30:00Z", endedAt: "2026-08-24T00:30:00Z" }], period);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].playstation, 1);
  assert.equal(rows[1].playstation, 0);
});

test("concurrency calculates simultaneous sessions instead of session starts", () => {
  const rows = buildConcurrencyBuckets([
    { activity: "billiard", status: "completed", startedAt: "2026-08-24T01:00:00Z", endedAt: "2026-08-24T01:20:00Z" },
    { activity: "billiards", status: "completed", startedAt: "2026-08-24T01:20:00Z", endedAt: "2026-08-24T01:50:00Z" },
  ], period);
  assert.equal(rows[1].billiard, 1);
});

test("open and currently paused sessions use the correct effective end", () => {
  const rows = buildConcurrencyBuckets([
    { activity: "pingpong", status: "active", startedAt: "2026-08-24T00:30:00Z", endedAt: null },
    { activity: "ping_pong", status: "paused", startedAt: "2026-08-24T00:10:00Z", pausedAt: "2026-08-24T00:40:00Z", endedAt: null },
  ], period);
  assert.equal(rows[0].pingpong, 2);
  assert.equal(rows[1].pingpong, 1);
});

test("revenue series preserve zeros and combined totals", () => {
  const rows = buildRevenueSeries([
    { key: "2026-08-01", activities: [{ type: "ps", revenue: 1200.5 }, { type: "pool", revenue: 300 }] },
    { key: "2026-08-02", activities: [] },
  ]);
  assert.equal(rows[0].playstation, 1200.5);
  assert.equal(rows[0].billiard, 300);
  assert.equal(rows[0].total, 1500.5);
  assert.deepEqual([rows[1].playstation, rows[1].billiard, rows[1].pingpong], [0, 0, 0]);
});

test("a daylight-saving day preserves its actual number of hourly buckets", () => {
  const rows = buildConcurrencyBuckets([], {
    from: "2026-11-01T04:00:00.000Z", to: "2026-11-02T05:00:00.000Z", timezone: "America/New_York",
  });
  assert.equal(rows.length, 25);
});

test("year data keeps all twelve zero-filled months", () => {
  const months = Array.from({ length: 12 }, (_, index) => ({ key: `2026-${String(index + 1).padStart(2, "0")}`, activities: [] }));
  const rows = buildRevenueSeries(months);
  assert.equal(rows.length, 12);
  assert.equal(rows.every((item) => item.total === 0), true);
});

test("currency formatting accepts tenant-provided ISO currency codes", () => {
  assert.match(formatCurrency(12500.5, "EUR"), /€|EUR/);
});
