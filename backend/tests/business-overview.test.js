import test from "node:test";
import assert from "node:assert/strict";
import { createBusinessOverviewService, createRequestScopedBusinessRepository } from "../src/features/business/business-overview.service.js";

function aggregateRow(range, bucket) {
  const key = bucket === "month" ? range.startDate.slice(0, 7) : range.startDate;
  return [{ bucket_key: key, activity_type: "billiard", session_count: 2, total_seconds: 3600, revenue: 20 }];
}

test("overview coalesces duplicate current-period aggregates and keeps every call tenant scoped", async () => {
  const aggregateCalls = [];
  const businessCalls = [];
  const repository = {
    async findBusiness(businessId) { businessCalls.push(businessId); return { id: businessId, created_at: "2026-01-01T00:00:00Z" }; },
    async aggregate(businessId, range, bucket) {
      aggregateCalls.push({ businessId, startDate: range.startDate, bucket });
      return aggregateRow(range, bucket);
    },
  };
  const analysisRepository = {
    async listExpenseHistory() { return []; },
    async listTargets() { return []; },
  };
  const service = createBusinessOverviewService({
    repository, analysisRepository, clock: () => new Date("2026-09-15T12:00:00Z"),
  });
  const result = await service.load({
    businessId: "tenant-a", timezone: "UTC", period: "monthly", year: 2026, month: 9, includeBusiness: true,
  });
  const currentDailyCalls = aggregateCalls.filter((call) => call.startDate === "2026-09-01" && call.bucket === "day");
  assert.equal(currentDailyCalls.length, 1);
  assert.ok(aggregateCalls.every((call) => call.businessId === "tenant-a"));
  assert.deepEqual(businessCalls, ["tenant-a"]);
  assert.equal(result.summary.metrics.revenue, 20);
  assert.ok(Array.isArray(result.summary.days));
  assert.equal(result.analysis.financial.totalRevenue, 20);
});

test("request-scoped aggregation cache keys include the tenant", async () => {
  const calls = [];
  const repository = {
    async aggregate(businessId) { calls.push(businessId); return [{ businessId }]; },
    async findBusiness(businessId) { calls.push(`business:${businessId}`); return { id: businessId }; },
  };
  const scoped = createRequestScopedBusinessRepository(repository);
  const range = { from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z", startDate: "2026-01-01", endDateExclusive: "2026-01-02" };
  const [first, duplicate, otherTenant] = await Promise.all([
    scoped.aggregate("tenant-a", range, "day", "UTC"),
    scoped.aggregate("tenant-a", range, "day", "UTC"),
    scoped.aggregate("tenant-b", range, "day", "UTC"),
  ]);
  assert.equal(first, duplicate);
  assert.notEqual(first, otherTenant);
  assert.deepEqual(calls, ["tenant-a", "tenant-b"]);
});
