import test from "node:test";
import assert from "node:assert/strict";
import {
  activityPerformance, calculateStatuses, compareValues, convertToUsd, expenseCostForPeriod,
  expenseSummary, financialSummary, targetForPeriod,
} from "../src/features/business/business-analysis.calculations.js";
import { resolveAnalysisPeriods } from "../src/features/business/business-analysis.periods.js";
import { buildInsights } from "../src/features/business/business-analysis.rules.js";
import { aggregateStationPerformance, buildFinancialTrend, createBusinessAnalysisService } from "../src/features/business/business-analysis.service.js";
import { applyExpenseVersionFilter } from "../src/features/business/business-analysis.repository.js";
import {
  validateBusinessAnalysis, validateExpense, validateExpenseUpdate, validateTarget, validateTargetUpdate,
} from "../src/features/business/business.validation.js";

const expense = (values = {}) => ({
  id: "expense-1", name: "Rent", category: "RENT", amount: 310, currency: "USD",
  exchangeRateToUsd: 1, amountUsd: 310, recurrence: "monthly", occurrenceDate: null,
  startDate: "2026-01-01", endDate: null, includeInProfit: true, notes: "", ...values,
});

test("expense pagination applies mutually exclusive current and historical version filters", () => {
  const calls = [];
  const query = {
    is(...args) { calls.push(["is", ...args]); return this; },
    not(...args) { calls.push(["not", ...args]); return this; },
  };
  assert.equal(applyExpenseVersionFilter(query, false), query);
  assert.equal(applyExpenseVersionFilter(query, true), query);
  assert.deepEqual(calls, [
    ["is", "valid_to", null],
    ["not", "valid_to", "is", null],
  ]);
});

test("financial calculations return revenue, costs, profit, margin, and safe zero-revenue behavior", () => {
  assert.deepEqual(financialSummary(1000, 250), { totalRevenue: 1000, totalCosts: 250, netProfit: 750, profitMargin: 75 });
  assert.deepEqual(financialSummary(0, 0), { totalRevenue: 0, totalCosts: 0, netProfit: 0, profitMargin: null });
  assert.equal(convertToUsd(8950000, "LBP", 89500), 100);
  assert.equal(convertToUsd(100, "USD", 1), 100);
});

test("activity revenue aggregates performance without allocating any expense", () => {
  const result = activityPerformance([
    { activity_type: "playstation", session_count: 2, total_seconds: 7200, revenue: 40 },
    { activity_type: "billiard", session_count: 1, total_seconds: 1800, revenue: 10 },
  ], [{ activity_type: "playstation", session_count: 1, total_seconds: 3600, revenue: 20 }]);
  assert.equal(result[0].averageSessionValue, 20);
  assert.equal(result[0].averageSessionDurationMinutes, 60);
  assert.equal(result[0].revenuePerHour, 20);
  assert.equal(result[0].revenueShare, 80);
  assert.equal(result[0].revenueComparison.percentageDifference, 100);
  assert.equal(Object.hasOwn(result[0], "costs"), false);
  assert.equal(Object.hasOwn(result[0], "profit"), false);
});

test("one-time and recurring expenses follow active dates and calendar-day proration", () => {
  assert.equal(expenseCostForPeriod(expense({ recurrence: "one_time", occurrenceDate: "2026-05-10", startDate: "2026-05-10", amountUsd: 90 }), "2026-05-01", "2026-06-01"), 90);
  assert.equal(expenseCostForPeriod(expense({ recurrence: "one_time", occurrenceDate: "2026-06-10", startDate: "2026-06-10", amountUsd: 90 }), "2026-05-01", "2026-06-01"), 0);
  assert.equal(expenseCostForPeriod(expense({ recurrence: "weekly", amountUsd: 70, startDate: "2026-05-03", endDate: "2026-05-05" }), "2026-05-01", "2026-05-10"), 30);
  assert.equal(expenseCostForPeriod(expense({ recurrence: "monthly", amountUsd: 310 }), "2026-05-01", "2026-05-11"), 100);
  assert.equal(expenseCostForPeriod(expense({ recurrence: "monthly", amountUsd: 310 }), "2026-05-01", "2026-06-01"), 310);
  assert.equal(expenseCostForPeriod(expense({ recurrence: "yearly", amountUsd: 366, startDate: "2024-01-01" }), "2024-01-01", "2024-01-03"), 2);
  assert.equal(expenseCostForPeriod(expense({ includeInProfit: false }), "2026-05-01", "2026-06-01"), 0);
});

test("effective-dated expense versions preserve historical recurring and one-time costs", () => {
  const recurringVersions = [
    expense({ id: "rent-v1", amountUsd: 310, validFrom: "2026-05-01", validTo: "2026-09-15" }),
    expense({ id: "rent-v2", amountUsd: 620, validFrom: "2026-09-15", supersedesExpenseId: "rent-v1" }),
  ];
  assert.equal(expenseSummary(recurringVersions, "2026-05-01", "2026-06-01").totalCosts, 310);
  assert.equal(expenseSummary(recurringVersions, "2026-09-01", "2026-10-01").totalCosts, 475.34);

  const oneTimeVersions = [
    expense({ id: "once-v1", recurrence: "one_time", occurrenceDate: "2026-05-10", startDate: "2026-05-10", amountUsd: 90, validFrom: "2026-05-10", validTo: "2026-09-15" }),
    expense({ id: "once-v2", recurrence: "one_time", occurrenceDate: "2026-05-10", startDate: "2026-05-10", amountUsd: 120, validFrom: "2026-09-15", supersedesExpenseId: "once-v1" }),
  ];
  assert.equal(expenseSummary(oneTimeVersions, "2026-05-01", "2026-06-01").totalCosts, 90);
});

test("analysis expense loading includes active records alongside closed history", async () => {
  const active = expense({ id: "active-rent", validFrom: "2026-09-01", validTo: null });
  const historical = expense({ id: "old-rent", validFrom: "2026-08-01", validTo: "2026-09-01" });
  const service = createBusinessAnalysisService({
    repository: {
      async listExpenses(businessId) {
        assert.equal(businessId, "tenant-a");
        return [active];
      },
      async listExpenseHistory(businessId) {
        assert.equal(businessId, "tenant-a");
        return [historical];
      },
    },
  });

  assert.deepEqual(await service.listExpenseHistory("tenant-a"), [active, historical]);
});

test("analysis range-limits expenses and targets to the required calculation window", async () => {
  const calls = [];
  const summaries = {
    async findBusiness() { return { created_at: "2026-01-01T00:00:00Z" }; },
    async aggregate() { return []; },
    async countCancelled() { return 0; },
  };
  const repository = {
    async listExpensesForRange(businessId, range) { calls.push(["expenses", businessId, range]); return []; },
    async listTargetsForRange(businessId, range) { calls.push(["targets", businessId, range]); return []; },
  };
  await createBusinessAnalysisService({ summaries, repository, clock: () => new Date("2026-09-15T12:00:00Z") }).analyze({
    businessId: "tenant-a", timezone: "Asia/Beirut", period: "monthly", year: 2026, month: 9,
  });
  assert.equal(calls.length, 2);
  assert.equal(calls.every(([, tenant]) => tenant === "tenant-a"), true);
  assert.deepEqual(calls[0][2], calls[1][2]);
  assert.equal(calls[0][2].endDateExclusive, "2026-10-01");
  assert.equal(calls[0][2].startDate <= "2026-08-01", true);
});

test("expense totals stay at business level and preserve the four-category breakdown", () => {
  const result = expenseSummary([
    expense({ amountUsd: 310, category: "RENT" }),
    expense({ amountUsd: 31, category: "ELECTRICITY" }),
  ], "2026-05-01", "2026-06-01");
  assert.equal(result.totalCosts, 341);
  assert.equal(result.breakdown.length, 4);
});

test("active daily, monthly, and yearly comparisons use the exact same elapsed duration", () => {
  const now = new Date("2026-09-15T11:00:00.000Z");
  const daily = resolveAnalysisPeriods({ period: "daily", date: "2026-09-15", businessDate: "2026-09-15", timezone: "Asia/Beirut", now });
  assert.equal(daily.current.from, "2026-09-15T03:00:00.000Z");
  assert.equal(daily.current.to, now.toISOString());
  assert.equal(daily.previous.to, "2026-09-14T11:00:00.000Z");

  const month = resolveAnalysisPeriods({ period: "monthly", year: 2026, month: 9, businessDate: "2026-09-15", timezone: "Asia/Beirut", now });
  assert.equal(month.current.endDateExclusive, "2026-09-16");
  assert.equal(month.previous.startDate, "2026-08-01");
  assert.equal(month.previous.endDateExclusive, "2026-08-16");
  assert.equal(month.current.from, "2026-09-01T03:00:00.000Z");
  assert.equal(new Date(month.current.to) - new Date(month.current.from), new Date(month.previous.to) - new Date(month.previous.from));

  const year = resolveAnalysisPeriods({ period: "yearly", year: 2026, businessDate: "2026-09-15", timezone: "Asia/Beirut", now });
  assert.equal(year.previous.endDateExclusive, "2025-09-16");
  assert.equal(new Date(year.current.to) - new Date(year.current.from), new Date(year.previous.to) - new Date(year.previous.from));
});

test("equivalent elapsed comparisons remain duration-equal across DST offsets", () => {
  const ranges = resolveAnalysisPeriods({
    period: "monthly", year: 2026, month: 11, businessDate: "2026-11-15",
    timezone: "America/New_York", now: new Date("2026-11-15T18:30:00.000Z"),
  });
  assert.equal(new Date(ranges.current.to) - new Date(ranges.current.from), new Date(ranges.previous.to) - new Date(ranges.previous.from));
});

test("weekly periods use Monday business boundaries and equal elapsed comparisons", () => {
  const partial = resolveAnalysisPeriods({
    period: "weekly", date: "2026-09-16", businessDate: "2026-09-16", timezone: "Asia/Beirut",
    now: new Date("2026-09-16T11:00:00.000Z"),
  });
  assert.equal(partial.current.startDate, "2026-09-14");
  assert.equal(partial.previous.startDate, "2026-09-07");
  assert.equal(new Date(partial.current.to) - new Date(partial.current.from), new Date(partial.previous.to) - new Date(partial.previous.from));
  const complete = resolveAnalysisPeriods({
    period: "weekly", date: "2026-08-03", businessDate: "2026-09-16", timezone: "Asia/Beirut",
  });
  assert.equal(complete.current.endDateExclusive, "2026-08-10");
  assert.equal(complete.current.isPartial, false);
});

test("financial trends preserve totals, categories, zero revenue, and partial ranges", () => {
  const expenses = [
    expense({ category: "RENT", amountUsd: 310 }),
    expense({ id: "electricity", category: "ELECTRICITY", amountUsd: 31 }),
  ];
  const trend = buildFinancialTrend([
    { bucket_key: "2026-05-01", session_count: 2, revenue: 100 },
    { bucket_key: "2026-05-02", session_count: 1, revenue: 0 },
  ], expenses, {
    startDate: "2026-05-01", endDateExclusive: "2026-05-04",
    from: "2026-05-01T03:00:00.000Z", to: "2026-05-04T03:00:00.000Z",
  }, "weekly");
  assert.equal(trend.length, 3);
  assert.deepEqual(trend[0], {
    key: "2026-05-01", totalRevenue: 100, totalCosts: 11, netProfit: 89, profitMargin: 89,
    sessions: 2, expenseCategories: { RENT: 10, ELECTRICITY: 1, EMPLOYEES: 0, OTHER: 0 },
  });
  assert.equal(trend[1].totalRevenue, 0);
  assert.equal(trend[1].profitMargin, null);
  const noExpenses = buildFinancialTrend([
    { bucket_key: "2026-05-01", session_count: 1, revenue: 25 },
  ], [], {
    startDate: "2026-05-01", endDateExclusive: "2026-05-02",
    from: "2026-05-01T03:00:00.000Z", to: "2026-05-02T03:00:00.000Z",
  }, "weekly");
  assert.equal(noExpenses[0].totalCosts, 0);
  assert.equal(noExpenses[0].netProfit, 25);
  const noData = buildFinancialTrend([], [], {
    startDate: "2026-05-01", endDateExclusive: "2026-05-02",
    from: "2026-05-01T03:00:00.000Z", to: "2026-05-02T03:00:00.000Z",
  }, "weekly");
  assert.equal(noData[0].totalRevenue, 0);
  assert.equal(noData[0].profitMargin, null);
});

test("hourly financial trend follows a DST-long business day and reconciles expenses", () => {
  const range = {
    startDate: "2026-10-31", endDateExclusive: "2026-11-01",
    from: "2026-10-31T10:00:00.000Z", to: "2026-11-01T11:00:00.000Z",
  };
  const trend = buildFinancialTrend([], [expense({ amountUsd: 31 })], range, "daily");
  assert.equal(trend.length, 25);
  assert.equal(Math.round(trend.reduce((sum, row) => sum + row.totalCosts, 0) * 100) / 100, 1);
});

test("comparison, target achievement, no-target, and all status families are safe", () => {
  assert.deepEqual(compareValues(10, 0), { current: 10, previous: 0, absoluteDifference: 10, percentageDifference: null, direction: "up" });
  const target = targetForPeriod([{ id: "t1", effectiveFrom: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", monthlyRevenueTargetUsd: 3100, monthlyProfitTargetUsd: 1550, maximumMonthlyCostsUsd: 620, minimumProfitMargin: 20 }], "2026-05-01", "2026-06-01");
  assert.equal(target.revenue, 3100);
  assert.equal(target.netProfit, 1550);
  assert.equal(target.maximumCosts, 620);
  assert.equal(calculateStatuses(financialSummary(4000, 400), financialSummary(1000, 300), target).target, "achieved");
  assert.equal(calculateStatuses(financialSummary(1000, 1000), financialSummary(1000, 1000), null).profitability, "break_even");
  assert.equal(calculateStatuses(financialSummary(100, 200), financialSummary(100, 100), null).profitability, "loss");
  assert.equal(calculateStatuses(financialSummary(100, 0), financialSummary(100, 0), null).target, "no_target");
});

test("rules engine returns structured numeric evidence without claiming causation", () => {
  const financial = financialSummary(80, 20);
  const previousFinancial = financialSummary(100, 20);
  const activities = activityPerformance([{ activity_type: "billiard", session_count: 8, total_seconds: 8000, revenue: 80 }], [{ activity_type: "billiard", session_count: 10, total_seconds: 10000, revenue: 100 }]);
  const statuses = calculateStatuses(financial, previousFinancial, null);
  const insights = buildInsights({ financial, previousFinancial, operations: { completedSessions: 8 }, previousOperations: { completedSessions: 10 }, activities, target: null, statuses });
  assert.ok(insights.some((item) => item.code === "revenue_and_sessions_down"));
  assert.ok(insights.every((item) => item.evidence && typeof item.message === "string"));
  assert.ok(insights.every((item) => !/caused by/i.test(item.message)));
});

test("rules engine explains each missed owner target with numeric evidence", () => {
  const financial = financialSummary(800, 500);
  const previousFinancial = financialSummary(750, 400);
  const target = { revenue: 1000, netProfit: 500, minimumProfitMargin: 40, maximumCosts: 450 };
  const statuses = calculateStatuses(financial, previousFinancial, target);
  const insights = buildInsights({
    financial, previousFinancial,
    operations: { completedSessions: 8, averageSessionValue: 10 }, previousOperations: { completedSessions: 8 },
    activities: [], target, statuses,
  });
  assert.ok(insights.some((item) => item.code === "sessions_to_revenue_target" && item.evidence.requiredSessions === 20 && item.evidence.remainingRevenue === 200));
  assert.ok(insights.some((item) => item.code === "revenue_below_target" && item.evidence.remaining === 200));
  assert.ok(insights.some((item) => item.code === "margin_below_target" && item.evidence.gap === 2.5));
  assert.ok(insights.some((item) => item.code === "costs_above_target" && item.evidence.overage === 50));
});

test("analysis service scopes every query to the authenticated tenant and calculates averages", async () => {
  const businessIds = [];
  const summaries = {
    async findBusiness(businessId) { businessIds.push(businessId); return { id: businessId, created_at: "2026-01-01T00:00:00Z" }; },
    async countCancelled(businessId) { businessIds.push(businessId); return 2; },
    async aggregate(businessId, range) {
      businessIds.push(businessId);
      if (range.startDate === "2026-09-01") return [{ bucket_key: "2026-09-05", activity_type: "playstation", session_count: 10, total_seconds: 36000, revenue: 200 }];
      if (range.startDate === "2026-08-01") return [{ bucket_key: "2026-08-05", activity_type: "playstation", session_count: 8, total_seconds: 28800, revenue: 160 }];
      const rows = [];
      for (let day = new Date(`${range.startDate}T12:00:00Z`); day < new Date(`${range.endDateExclusive}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
        rows.push({ bucket_key: day.toISOString().slice(0, 10), activity_type: "billiard", session_count: 1, total_seconds: 3600, revenue: 10 });
      }
      return rows;
    },
  };
  const repository = {
    async listExpenses(businessId) { businessIds.push(businessId); return []; },
    async listTargets(businessId) { businessIds.push(businessId); return []; },
  };
  const result = await createBusinessAnalysisService({ summaries, repository, clock: () => new Date("2026-09-15T12:00:00Z") }).analyze({ businessId: "tenant-a", timezone: "Asia/Beirut", period: "monthly", year: 2026, month: 9 });
  assert.ok(businessIds.length >= 6 && businessIds.every((id) => id === "tenant-a"));
  assert.equal(result.financial.totalRevenue, 200);
  assert.equal(result.operations.cancelledSessions, 2);
  assert.equal(result.operations.cancellationRate, 16.67);
  assert.equal(Object.hasOwn(result.operations, "lostRevenue"), false);
  assert.deepEqual(result.comparisons.previousPeriod.completedSessions, {
    current: 10, previous: 8, absoluteDifference: 2, percentageDifference: 25, direction: "up",
  });
  assert.equal(result.averages.status, "available");
  assert.notEqual(result.averages.rolling7DayAverage, null);
  assert.notEqual(result.averages.previousThreeMonthAverage, null);
  assert.equal(result.dataQuality.hasTarget, false);
});

test("current partial business day keeps scheduled daily expenses while clipping revenue to now", async () => {
  const summaries = {
    async findBusiness() { return { created_at: "2026-01-01T00:00:00Z" }; },
    async countCancelled() { return 0; },
    async aggregate(_businessId, range) {
      return range.startDate === "2026-09-15"
        ? [{ bucket_key: "2026-09-15", activity_type: "billiard", session_count: 1, total_seconds: 3600, revenue: 20 }]
        : [];
    },
  };
  const repository = {
    async listExpenses() { return [expense({ amountUsd: 300, startDate: "2026-09-01" })]; },
    async listTargets() { return []; },
  };
  const now = new Date("2026-09-15T12:00:00.000Z");
  const result = await createBusinessAnalysisService({ summaries, repository, clock: () => now }).analyze({
    businessId: "tenant-a", timezone: "Asia/Beirut", period: "daily", date: "2026-09-15",
  });
  assert.equal(result.period.isPartial, true);
  assert.equal(result.period.to, now.toISOString());
  assert.equal(result.financial.totalRevenue, 20);
  assert.equal(result.financial.totalCosts, 10);
  assert.equal(result.financial.netProfit, 10);
});

test("new tenants report insufficient history and owner mutations keep server-resolved identity", async () => {
  const calls = [];
  const summaries = {
    async findBusiness() { return { created_at: "2026-09-14T08:00:00Z" }; },
    async aggregate() { return []; },
  };
  const repository = {
    async listExpenses() { return []; },
    async listTargets() { return []; },
    async saveExpense(businessId, userId, expenseId, values) {
      calls.push({ businessId, userId, expenseId, values });
      return { outcome: "saved", expense: { id: "e1", ...values } };
    },
  };
  const service = createBusinessAnalysisService({ summaries, repository, clock: () => new Date("2026-09-15T12:00:00Z") });
  const analysis = await service.analyze({ businessId: "tenant-new", timezone: "Asia/Beirut", period: "daily", date: "2026-09-15" });
  assert.equal(analysis.averages.status, "insufficient_history");
  assert.equal(analysis.averages.averageDailyRevenue, null);
  const saved = await service.saveExpense({ businessId: "tenant-new", userId: "owner-1", values: { name: "Rent" } });
  assert.equal(saved.id, "e1");
  assert.deepEqual(calls[0], { businessId: "tenant-new", userId: "owner-1", expenseId: null, values: { name: "Rent", effectiveDate: "2026-09-15" } });
});

test("expense deletion is effective-dated and target conflicts become HTTP 409 errors", async () => {
  const calls = [];
  const repository = {
    async listExpenses() { return []; },
    async deleteExpense(businessId, userId, expenseId, effectiveDate) {
      calls.push({ businessId, userId, expenseId, effectiveDate });
      return "deleted";
    },
    async saveTarget() { return { outcome: "conflict", target: null }; },
  };
  const service = createBusinessAnalysisService({ repository, clock: () => new Date("2026-09-15T02:30:00Z") });
  await service.deleteExpense({ businessId: "tenant-a", userId: "owner-1", timezone: "Asia/Beirut", expenseId: "expense-1" });
  assert.deepEqual(calls[0], { businessId: "tenant-a", userId: "owner-1", expenseId: "expense-1", effectiveDate: "2026-09-14" });
  await assert.rejects(
    service.saveTarget({ businessId: "tenant-a", userId: "owner-1", values: { monthlyTotalTarget: 1000, effectiveFrom: "2026-09-01" } }),
    (error) => error.statusCode === 409 && error.code === "CONFLICT",
  );
});

test("target saving derives expected profit from recorded monthly costs and supports deletion", async () => {
  const calls = [];
  const repository = {
    async listExpenses() { return [expense({ amountUsd: 310 })]; },
    async saveTarget(businessId, userId, targetId, values) {
      calls.push({ operation: "save", businessId, userId, targetId, values });
      return { outcome: "saved", target: { id: "target-1", ...values } };
    },
    async findTarget() { return { id: "target-1", effectiveFrom: "2026-05-01" }; },
    async deleteTarget(businessId, userId, targetId) {
      calls.push({ operation: "delete", businessId, userId, targetId });
      return "deleted";
    },
  };
  const service = createBusinessAnalysisService({ repository, clock: () => new Date("2026-05-15T12:00:00Z") });
  const target = await service.saveTarget({ businessId: "tenant-a", userId: "owner-1", values: { monthlyTotalTarget: 1000, effectiveFrom: "2026-05-01" } });
  assert.equal(target.monthlyRevenueTarget, 1000);
  assert.equal(target.monthlyProfitTarget, 690);
  assert.equal(target.minimumProfitMargin, 69);
  await service.deleteTarget({ businessId: "tenant-a", userId: "owner-1", targetId: "target-1" });
  assert.deepEqual(calls[1], { operation: "delete", businessId: "tenant-a", userId: "owner-1", targetId: "target-1" });
  await assert.rejects(
    service.saveTarget({ businessId: "tenant-a", userId: "owner-1", values: { monthlyTotalTarget: 300, effectiveFrom: "2026-05-01" } }),
    (error) => error.code === "TARGET_BELOW_COSTS",
  );
});

test("closed target months cannot be created, edited, or deleted", async () => {
  const calls = [];
  const repository = {
    async findTarget(businessId, targetId) {
      calls.push(["find", businessId, targetId]);
      return { id: targetId, effectiveFrom: "2026-08-01" };
    },
    async listExpenses() { return []; },
    async saveTarget() { calls.push(["save"]); return { outcome: "saved", target: {} }; },
    async deleteTarget() { calls.push(["delete"]); return "deleted"; },
  };
  const service = createBusinessAnalysisService({ repository, clock: () => new Date("2026-09-15T12:00:00Z") });
  const closed = (operation) => assert.rejects(operation, (error) => error.statusCode === 409 && error.code === "TARGET_PERIOD_CLOSED");
  await closed(service.saveTarget({ businessId: "tenant-a", userId: "owner-1", timezone: "Asia/Beirut", values: { monthlyTotalTarget: 1000, effectiveFrom: "2026-08-01" } }));
  await closed(service.saveTarget({ businessId: "tenant-a", userId: "owner-1", timezone: "Asia/Beirut", targetId: "target-1", values: { monthlyTotalTarget: 1000, effectiveFrom: "2026-09-01" } }));
  await closed(service.deleteTarget({ businessId: "tenant-a", userId: "owner-1", timezone: "Asia/Beirut", targetId: "target-1" }));
  assert.equal(calls.some(([operation]) => operation === "save" || operation === "delete"), false);
});

test("decision support recalculates target profit from current costs and produces an actionable monthly plan", async () => {
  const target = {
    id: "target-1", effectiveFrom: "2026-09-01", createdAt: "2026-09-01T00:00:00Z",
    monthlyRevenueTargetUsd: 620, monthlyProfitTargetUsd: 400,
    maximumMonthlyCostsUsd: null, minimumProfitMargin: 64.52,
  };
  const summaries = {
    async findBusiness() { return { created_at: "2026-01-01T00:00:00Z" }; },
    async aggregate(_businessId, range) {
      return range.startDate === "2026-09-01"
        ? [{ bucket_key: "2026-09-15", activity_type: "billiard", session_count: 10, total_seconds: 36000, revenue: 200 }]
        : [];
    },
  };
  const repository = {
    async listExpenses() { return [expense({ amountUsd: 310, startDate: "2026-09-01" })]; },
    async listTargets() { return [target]; },
  };
  const service = createBusinessAnalysisService({ summaries, repository, clock: () => new Date("2026-09-15T12:00:00Z") });
  const analysis = await service.analyze({ businessId: "tenant-a", timezone: "Asia/Beirut", period: "monthly", year: 2026, month: 9 });
  assert.equal(analysis.comparisons.target.values.netProfit, 155);
  assert.deepEqual(analysis.decisionSupport, {
    hasTarget: true, periodClosed: false, fullRevenueTarget: 620, expectedCosts: 310,
    expectedNetProfit: 310, revenueProgress: 32.26, revenueRemaining: 420, daysRemaining: 16,
    requiredDailyRevenue: 26.25, averageSessionValue: 20, requiredSessions: 21,
    costBasisChanged: true, targetCostBasis: 220,
  });
  const listed = await service.listTargets("tenant-a");
  assert.equal(listed[0].recordedCostsUsd, 310);
  assert.equal(listed[0].calculatedProfitUsd, 310);
  assert.equal(listed[0].costBasisChanged, true);
});

test("expense and target validation rejects unsafe input and accepts normalized owner data", () => {
  const validExpense = validateExpense({ body: { name: " Rent ", category: "rent", amount: 100, currency: "USD", recurrence: "monthly", startDate: "2026-09-01", includeInProfit: true } });
  assert.equal(validExpense.success, true);
  assert.equal(validExpense.data.exchangeRateToUsd, 1);
  assert.equal(validateExpense({ body: { ...validExpense.data, amount: -1 } }).success, false);
  assert.equal(validateExpenseUpdate({ params: { expenseId: "../bad" }, body: validExpense.data }).success, false);
  assert.equal(validateBusinessAnalysis({ query: { period: "monthly", year: "2026", month: "9" } }).success, true);
  assert.equal(validateBusinessAnalysis({ query: { period: "week" } }).success, false);
  assert.equal(validateTarget({ body: { monthlyTotalTarget: 1000, effectiveFrom: "2026-09-01" } }).success, true);
  assert.equal(validateExpense({ body: { name: "Payroll", category: "employees", amount: 89_500_000_000, currency: "LBP", exchangeRateToUsd: 89500, recurrence: "monthly", startDate: "2026-09-01" } }).success, true);
  assert.equal(validateTarget({ body: { monthlyTotalTarget: 1000, effectiveFrom: "2026-09-05" } }).success, false);
  assert.equal(validateTarget({ body: { monthlyTotalTarget: 0, effectiveFrom: "2026-09-01" } }).success, false);
  assert.equal(validateTarget({ body: { monthlyTotalTarget: 90_000_000_000_001, effectiveFrom: "2026-09-01" } }).success, false);
  assert.equal(validateTargetUpdate({ params: { targetId: "8ad8b539-1018-4bc0-8fe2-d81566f1de48" }, body: { monthlyTotalTarget: 1000, effectiveFrom: "2026-09-01" } }).success, true);
});

test("station performance prefers completion snapshots and reports legacy fallbacks", () => {
  const result = aggregateStationPerformance([
    { final_cost: 20, final_elapsed_seconds: 7200, station_type_at_completion: "playstation", station_number_at_completion: 2, station: { type: "billiard", number: 9 } },
    { final_cost: 10, final_elapsed_seconds: 3600, station_type_at_completion: "playstation", station_number_at_completion: 2, station: { type: "playstation", number: 2 } },
    { final_cost: 5, final_elapsed_seconds: 1800, station: { type: "billiard", number: 4 } },
  ]);
  assert.equal(result.stations[0].station, "PlayStation 2");
  assert.equal(result.stations[0].completedSessions, 2);
  assert.equal(result.stations[0].averageSessionValue, 15);
  assert.equal(result.stations[0].averageSessionDurationMinutes, 90);
  assert.equal(result.dataQuality.legacyFallbackSessions, 1);
});

test("station performance formats database-aggregated rows without session-level loading", () => {
  const result = aggregateStationPerformance([
    { activity_type: "playstation", station_number: 2, revenue: "30.00", session_count: 2, total_seconds: 10800, legacy_fallback_sessions: 1 },
  ]);
  assert.equal(result.stations[0].station, "PlayStation 2");
  assert.equal(result.stations[0].averageSessionValue, 15);
  assert.equal(result.stations[0].averageSessionDurationMinutes, 90);
  assert.equal(result.dataQuality.legacyFallbackSessions, 1);
});

test("station performance endpoint uses the selected tenant period", async () => {
  const calls = [];
  const summaries = {
    async findBusiness(id) { return id === "tenant-a" ? { id } : null; },
    async findStationPerformanceSessions(id, range) { calls.push({ id, range }); return []; },
  };
  const service = createBusinessAnalysisService({ summaries, repository: {}, clock: () => new Date("2026-09-20T12:00:00Z") });
  const result = await service.stationPerformance({ businessId: "tenant-a", timezone: "Asia/Beirut", period: "daily", date: "2026-09-19" });
  assert.equal(calls[0].id, "tenant-a");
  assert.equal(calls[0].range.startDate, "2026-09-19");
  assert.deepEqual(result.stations, []);
});

test("station performance endpoint prefers database aggregation when available", async () => {
  const calls = [];
  const summaries = {
    async findBusiness() { return { id: "tenant-a" }; },
    async findStationPerformance(id, range) {
      calls.push({ id, range });
      return [{ activity_type: "billiard", station_number: 3, session_count: 4, total_seconds: 7200, revenue: 40, legacy_fallback_sessions: 0 }];
    },
    async findStationPerformanceSessions() { throw new Error("raw session fallback should not run"); },
  };
  const result = await createBusinessAnalysisService({ summaries, repository: {}, clock: () => new Date("2026-09-20T12:00:00Z") })
    .stationPerformance({ businessId: "tenant-a", timezone: "Asia/Beirut", period: "daily", date: "2026-09-19" });
  assert.equal(calls[0].id, "tenant-a");
  assert.equal(result.stations[0].station, "Billiard 3");
  assert.equal(result.stations[0].completedSessions, 4);
});

test("paginated expense and target management never substitutes a requested tenant id", async () => {
  const calls = [];
  const repository = {
    async listExpensePage(businessId, values) { calls.push(["expenses", businessId, values.page]); return { items: [], total: 0, page: values.page, pageSize: values.pageSize, hasMore: false }; },
    async listTargetPage(businessId, values) { calls.push(["targets", businessId, values.page]); return { items: [], total: 0, page: values.page, pageSize: values.pageSize, hasMore: false }; },
    async listExpenses(businessId) { calls.push(["expense-history", businessId]); return []; },
  };
  const service = createBusinessAnalysisService({ repository });
  await service.listExpensePage("tenant-a", { page: 2, pageSize: 20 });
  await service.listTargetPage("tenant-a", { page: 3, pageSize: 20 });
  assert.deepEqual(calls, [["expenses", "tenant-a", 2], ["targets", "tenant-a", 3]]);
});
