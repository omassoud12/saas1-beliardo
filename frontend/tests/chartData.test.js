import test from "node:test";
import assert from "node:assert/strict";
import { buildConcurrencyBuckets, buildMonthlyRevenueData, buildRevenueSeries, normalizeActivityType, summarizeMonthlyRevenue } from "../src/utils/chartData.js";
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

test("current-month future days are null instead of zero", () => {
  const days = Array.from({ length: 31 }, (_, index) => ({ key: `2026-08-${String(index + 1).padStart(2, "0")}`, activities: [] }));
  days[9].activities = [{ type: "playstation", revenue: 25 }];
  const rows = buildMonthlyRevenueData(days, { businessDate: "2026-08-15" });
  assert.equal(rows[14].total, 0);
  assert.equal(rows[15].total, null);
  assert.equal(rows[15].isFuture, true);
});

test("before 06:00 the frontend honors the backend's previous business date", () => {
  const days = [
    { key: "2026-08-26", activities: [] },
    { key: "2026-08-27", activities: [] },
  ];
  const rows = buildMonthlyRevenueData(days, { businessDate: "2026-08-26" });
  assert.equal(rows[0].isFuture, false);
  assert.equal(rows[1].isFuture, true);
});

test("monthly summary excludes future dates and calculates active-day metrics", () => {
  const rows = [
    { key: "2026-08-01", total: 40, isFuture: false },
    { key: "2026-08-02", total: 0, isFuture: false },
    { key: "2026-08-03", total: 80, isFuture: false },
    { key: "2026-08-04", total: null, isFuture: true },
  ];
  const summary = summarizeMonthlyRevenue(rows);
  assert.equal(summary.monthlyRevenue, 120);
  assert.equal(summary.averagePerActiveDay, 60);
  assert.equal(summary.bestDay.key, "2026-08-03");
});

test("historical leap-year February keeps all 29 observed days", () => {
  const days = Array.from({ length: 29 }, (_, index) => ({ key: `2024-02-${String(index + 1).padStart(2, "0")}`, activities: [] }));
  const rows = buildMonthlyRevenueData(days, { businessDate: "2026-01-01" });
  assert.equal(rows.length, 29);
  assert.equal(rows.every((row) => !row.isFuture && row.total === 0), true);
});
