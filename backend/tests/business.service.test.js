import test from "node:test";
import assert from "node:assert/strict";
import { createBusinessService } from "../src/features/business/business.service.js";
import { aggregateSessionRows, isAnalyticsRpcMissing } from "../src/features/business/business.repository.js";

const row = (bucket, type, sessions, seconds, revenue) => ({
  bucket_key: bucket,
  activity_type: type,
  session_count: sessions,
  total_seconds: seconds,
  revenue,
});

function assertReconciles(summary, buckets) {
  const activityTotals = summary.activities.reduce((total, activity) => ({
    sessions: total.sessions + activity.sessions,
    seconds: total.seconds + activity.totalSeconds,
    revenue: total.revenue + activity.revenue,
  }), { sessions: 0, seconds: 0, revenue: 0 });
  const bucketTotals = buckets.reduce((total, bucket) => ({
    sessions: total.sessions + bucket.total.sessions,
    seconds: total.seconds + bucket.total.totalSeconds,
    revenue: total.revenue + bucket.total.revenue,
  }), { sessions: 0, seconds: 0, revenue: 0 });
  assert.deepEqual(activityTotals, bucketTotals);
}

test("missing analytics RPC is detected for the direct-query fallback", () => {
  assert.equal(isAnalyticsRpcMissing({ code: "PGRST202", message: "Could not find get_business_analytics" }), true);
  assert.equal(isAnalyticsRpcMissing({ code: "PGRST202", message: "Could not find another_function" }), false);
});

test("analytics fallback applies the 06:00 business date and aggregates activities", () => {
  const rows = [
    { ended_at: "2026-08-27T02:30:00.000Z", final_elapsed_seconds: 1800, final_cost: 5, station: { type: "billiard" } },
    { ended_at: "2026-08-27T03:30:00.000Z", final_elapsed_seconds: 3600, final_cost: 10, station: { type: "billiard" } },
    { ended_at: "2026-08-27T03:45:00.000Z", final_elapsed_seconds: 900, final_cost: 4, station: [{ type: "playstation" }] },
  ];
  assert.deepEqual(aggregateSessionRows(rows, "day", "Asia/Beirut"), [
    row("2026-08-26", "billiard", 1, 1800, 5),
    row("2026-08-27", "billiard", 1, 3600, 10),
    row("2026-08-27", "playstation", 1, 900, 4),
  ]);
});

test("daily analytics reconcile activities and expose open session count", async () => {
  const repository = {
    async aggregate() {
      return [
        row("2026-08-24T10:00", "playstation", 2, 3600, 10),
        row("2026-08-24T10:00", "billiard", 1, 1800, 6),
        row("2026-08-24T14:00", "pingpong", 1, 900, 3),
      ];
    },
    async findDailySessions() {
      return [{
        id: "open", status: "active", hourly_rate: 12, controller_count: 3, started_at: "2026-08-24T16:00:00Z",
        paused_at: null, ended_at: null, total_paused_seconds: 0,
        final_elapsed_seconds: null, final_cost: null,
        station: { type: "playstation", number: 1 },
      }];
    },
    async findConcurrencySessions() {
      return [{
        id: "crossing", status: "completed", hourly_rate: 12,
        started_at: "2026-08-23T22:30:00Z", paused_at: null,
        ended_at: "2026-08-24T01:15:00Z", total_paused_seconds: 0,
        final_elapsed_seconds: 9900, final_cost: 33,
        station: { type: "billiard", number: 2 },
      }];
    },
  };
  const result = await createBusinessService({ repository }).daily({
    businessId: "business-a", timezone: "Asia/Beirut", date: "2026-08-24",
  });
  assert.equal(result.metrics.totalSessions, 5);
  assert.equal(result.metrics.completedSessions, 4);
  assert.equal(result.metrics.peakActivity, 3);
  assert.equal(result.metrics.revenue, 19);
  assert.equal(result.traffic.length, 24);
  assert.equal(result.concurrencySessions.length, 1);
  assert.equal(result.concurrencySessions[0].activity, "billiard");
  assert.equal(result.sessions[0].controllerCount, 3);
  assertReconciles(result, result.traffic);
});

test("monthly analytics fill calendar days and reconcile totals", async () => {
  const repository = {
    async aggregate() {
      return [
        row("2026-08-01", "playstation", 2, 3600, 10),
        row("2026-08-01", "billiard", 1, 1800, 6),
        row("2026-08-12", "pingpong", 1, 900, 3),
      ];
    },
  };
  const result = await createBusinessService({ repository }).monthly({
    businessId: "business-a", timezone: "Asia/Beirut", year: 2026, month: 8,
  });
  assert.equal(result.days.length, 31);
  assert.equal(result.metrics.trackedDays, 2);
  assert.equal(result.metrics.sessionCount, 4);
  assert.equal(result.metrics.revenue, 19);
  assertReconciles(result, result.days);
});

test("yearly analytics reconcile monthly totals and unique tracked days", async () => {
  const repository = {
    async aggregate(_businessId, _range, bucket) {
      if (bucket === "day") {
        return [
          row("2026-01-03", "playstation", 1, 1800, 5),
          row("2026-01-03", "billiard", 1, 1800, 4),
          row("2026-08-12", "pingpong", 1, 900, 3),
        ];
      }
      return [
        row("2026-01", "playstation", 1, 1800, 5),
        row("2026-01", "billiard", 1, 1800, 4),
        row("2026-08", "pingpong", 1, 900, 3),
      ];
    },
  };
  const result = await createBusinessService({ repository }).yearly({
    businessId: "business-a", timezone: "Asia/Beirut", year: 2026,
  });
  assert.equal(result.months.length, 12);
  assert.equal(result.metrics.trackedDays, 2);
  assert.equal(result.metrics.revenue, 12);
  assertReconciles(result, result.months);
});
