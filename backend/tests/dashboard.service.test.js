import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardService } from "../src/features/dashboard/dashboard.service.js";

const completed = [
  { ended_at: "2026-08-23T22:30:00.000Z", final_cost: 12, final_elapsed_seconds: 3600, stations: { type: "billiard" } },
  { ended_at: "2026-08-24T10:00:00.000Z", final_cost: 8, final_elapsed_seconds: 1800, stations: { type: "playstation" } },
];

test("dashboard summary applies business timezone range and totals", async () => {
  let receivedRange;
  const repository = {
    async findCompletedSessions(_businessId, range) { receivedRange = range; return completed; },
    async getOperationalCounts() {
      return { stationCount: 4, activeSessionCount: 2, stationStatusCounts: { available: 2, active: 1, paused: 1 } };
    },
  };
  const service = createDashboardService({
    repository,
    clock: () => new Date("2026-08-24T12:00:00.000Z"),
  });
  const summary = await service.getSummary({ businessId: "business-a", timezone: "Asia/Beirut", period: "month" });
  assert.equal(receivedRange.from, "2026-07-31T21:00:00.000Z");
  assert.equal(receivedRange.to, "2026-08-31T21:00:00.000Z");
  assert.equal(summary.revenue, 20);
  assert.equal(summary.totalHours, 1.5);
  assert.equal(summary.sessionCount, 2);
  assert.deepEqual(summary.sessionsByType, { billiard: 1, pingpong: 0, playstation: 1 });
});

test("daily chart buckets completed sessions in the business timezone", async () => {
  const repository = {
    async findCompletedSessions() { return completed; },
    async getOperationalCounts() { return {}; },
  };
  const service = createDashboardService({ repository, clock: () => new Date("2026-08-24T12:00:00.000Z") });
  const chart = await service.getChart({
    businessId: "business-a", timezone: "Asia/Beirut", granularity: "daily",
    from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z",
  });
  assert.deepEqual(chart.data, [{
    key: "2026-08-24", revenue: 20, totalSeconds: 5400, sessionCount: 2, totalHours: 1.5,
  }]);
});
