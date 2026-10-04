import test from "node:test";
import assert from "node:assert/strict";
import { validateHistoricalPayload } from "../src/features/business/business-historical.validation.js";
import { createBusinessHistoricalService } from "../src/features/business/business-historical.service.js";
import { activityPerformance, expenseSummaryForPeriod } from "../src/features/business/business-analysis.calculations.js";
import { createBusinessService } from "../src/features/business/business.service.js";

const businessDate = "2026-09-22";
const record = (values = {}) => ({
  business_date: "2026-01-02",
  revenue: { total: "2700000.00", currency: "LBP", exchange_rate_to_usd: "90000.00" },
  ...values,
});
const payload = (records = [record()], values = {}) => ({
  schema_version: "1.0",
  data_type: "historical_business_data",
  period_type: "daily",
  coverage: { start_business_date: records[0].business_date, end_business_date: records.at(-1).business_date, mode: "partial" },
  source: { type: "manual_ledger", reference: "Old ledger" },
  records,
  ...values,
});

test("historical validator normalizes USD, LBP, optional expenses, operations, and activity", () => {
  const result = validateHistoricalPayload(payload([
    record({
      revenue: {
        total: "2700000.00", currency: "LBP", exchange_rate_to_usd: "90000.00",
        by_activity: [{ activity_type: "playstation", revenue: "2700000.00" }],
      },
      expenses: { total: "450000.00", currency: "LBP", exchange_rate_to_usd: "90000.00" },
      operations: { completed_sessions: 12, total_duration_seconds: 36000 },
    }),
    record({ business_date: "2026-01-03", revenue: { total: "0.00", currency: "USD" }, operations: { completed_sessions: 0 } }),
  ]), { businessDate });
  assert.equal(result.success, true);
  assert.equal(result.data.records[0].revenue.usd, "30.00");
  assert.equal(result.data.records[0].expenses.usd, "5.00");
  assert.equal(result.data.records[1].revenue.exchange_rate_to_usd, "1.000000");
});

test("complete historical coverage requires every date including explicit zero days", () => {
  const values = payload([record(), record({ business_date: "2026-01-04" })]);
  values.coverage = { start_business_date: "2026-01-02", end_business_date: "2026-01-04", mode: "complete" };
  const result = validateHistoricalPayload(values, { businessDate });
  assert.equal(result.success, false);
  assert.match(result.errors.join(" "), /every declared business date/);
});

test("historical validator rejects malformed and unsafe contracts", async (t) => {
  const cases = [
    ["non-object", null],
    ["schema", payload([record()], { schema_version: "2.0" })],
    ["type", payload([record()], { data_type: "other" })],
    ["monthly", payload([record()], { period_type: "monthly" })],
    ["duplicate dates", payload([record(), record()])],
    ["negative revenue", payload([record({ revenue: { total: "-1.00", currency: "USD" } })])],
    ["invalid currency", payload([record({ revenue: { total: "1.00", currency: "EUR" } })])],
    ["LBP rate", payload([record({ revenue: { total: "1.00", currency: "LBP" } })])],
    ["activity", payload([record({ revenue: { total: "1.00", currency: "USD", by_activity: [{ activity_type: "arcade", revenue: "1.00" }] } })])],
    ["activity mismatch", payload([record({ revenue: { total: "2.00", currency: "USD", by_activity: [{ activity_type: "billiard", revenue: "1.00" }] } })])],
    ["open date", payload([record({ business_date: businessDate })])],
    ["tenant property", { ...payload(), business_id: "another-tenant" }],
  ];
  for (const [name, values] of cases) await t.test(name, () => {
    assert.equal(validateHistoricalPayload(values, { businessDate }).success, false);
  });
});

test("preview stays tenant scoped and blocks live/history and repeated-file conflicts", async () => {
  const calls = [];
  const service = createBusinessHistoricalService({ repository: {
    async inspect(businessId, userId, dates, hash) {
      calls.push({ businessId, userId, dates, hash });
      return { duplicateFile: true, conflictDates: [dates[0]] };
    },
  } });
  const normalized = validateHistoricalPayload(payload(), { businessDate }).data;
  const result = await service.preview({ businessId: "tenant-a", userId: "owner-a", payload: normalized });
  assert.equal(calls[0].businessId, "tenant-a");
  assert.equal(calls[0].userId, "owner-a");
  assert.equal(calls[0].hash.length, 64);
  assert.equal(result.canConfirm, false);
  assert.equal(result.duplicateFile, true);
  assert.equal(result.records[0].status, "conflict");
});

test("confirmation delegates one normalized batch to the atomic tenant operation", async () => {
  const calls = [];
  const service = createBusinessHistoricalService({ repository: {
    async save(businessId, userId, hash, values) {
      calls.push({ businessId, userId, hash, values });
      return { outcome: "saved", record: { id: "import-1", record_count: 1, coverage_start: "2026-01-02", coverage_end: "2026-01-02", status: "active", confirmed_at: "2026-09-22T12:00:00Z" } };
    },
  } });
  const normalized = validateHistoricalPayload(payload(), { businessDate }).data;
  const saved = await service.confirm({ businessId: "tenant-a", userId: "owner-a", payload: normalized });
  assert.equal(saved.recordCount, 1);
  assert.equal(calls[0].businessId, "tenant-a");
  assert.equal(calls[0].values.records[0].revenue.usd, "30.00");
});

test("historical expenses override scheduled costs while missing expenses keep profit incomplete", () => {
  const expense = { category: "RENT", amountUsd: 310, recurrence: "monthly", startDate: "2026-01-01", endDate: null, validFrom: "2026-01-01", validTo: null, includeInProfit: true };
  const known = expenseSummaryForPeriod([expense], [{ businessDate: "2026-01-02", expensesUsd: 5 }], "2026-01-02", "2026-01-03");
  assert.equal(known.totalCosts, 5);
  assert.equal(known.complete, true);
  const unknown = expenseSummaryForPeriod([expense], [{ businessDate: "2026-01-02", expensesUsd: null }], "2026-01-02", "2026-01-03");
  assert.equal(unknown.totalCosts, 0);
  assert.equal(unknown.complete, false);
});

test("imported activity revenue without operational detail never fabricates efficiency", () => {
  const activity = activityPerformance([{ bucket_key: "2026-01-02", activity_type: "playstation", revenue: 30, session_count: 0, total_seconds: 0, is_historical: true, activity_operations_known: false }], [], 30)[0];
  assert.equal(activity.revenue, 30);
  assert.equal(activity.averageSessionValue, null);
  assert.equal(activity.averageSessionDurationMinutes, null);
  assert.equal(activity.revenuePerHour, null);
});

test("daily summary uses historical day totals but keeps hourly traffic session-only", async () => {
  const repository = {
    async aggregate(_businessId, _range, bucket) {
      return bucket === "day" ? [{ bucket_key: "2026-01-02", activity_type: null, revenue: 30, session_count: 0, total_seconds: 0, is_historical: true, row_kind: "revenue", operations_known: false, duration_known: false }] : [];
    },
    async findDailySessions() { return { items: [], total: 0, page: 1, pageSize: 50, hasMore: false, openCount: 0 }; },
    async findConcurrencySessions() { return []; },
  };
  const summary = await createBusinessService({ repository, clock: () => new Date("2026-09-22T12:00:00Z") }).daily({ businessId: "tenant-a", timezone: "Asia/Beirut", date: "2026-01-02" });
  assert.equal(summary.metrics.revenue, 30);
  assert.equal(summary.traffic.every((bucket) => bucket.total.revenue === 0), true);
  assert.deepEqual(summary.sessions, []);
});

test("partial historical coverage marks missing calendar dates as unknown instead of zero", async () => {
  const repository = {
    async aggregate() { return []; },
    async listHistoricalCoverage() { return [{ start: "2026-01-01", end: "2026-01-03", mode: "partial" }]; },
  };
  const summary = await createBusinessService({ repository, clock: () => new Date("2026-09-22T12:00:00Z") })
    .monthly({ businessId: "tenant-a", timezone: "Asia/Beirut", year: 2026, month: 1 });
  assert.equal(summary.days[0].total.revenue, 0);
  assert.equal(summary.days[0].dataQuality.historicalCoverageUnknown, true);
  assert.equal(summary.days[3].dataQuality.historicalCoverageUnknown, false);
  assert.equal(summary.dataQuality.historicalCoveragePartial, true);
});
