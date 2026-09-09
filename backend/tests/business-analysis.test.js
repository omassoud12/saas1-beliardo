import test from "node:test";
import assert from "node:assert/strict";
import {
  activityPerformance, calculateStatuses, compareValues, convertToUsd, expenseCostForPeriod,
  expenseSummary, financialSummary, targetForPeriod,
} from "../src/features/business/business-analysis.calculations.js";
import { resolveAnalysisPeriods } from "../src/features/business/business-analysis.periods.js";
import { buildInsights } from "../src/features/business/business-analysis.rules.js";
import { createBusinessAnalysisService } from "../src/features/business/business-analysis.service.js";
import {
  validateBusinessAnalysis, validateExpense, validateExpenseUpdate, validateTarget, validateTargetUpdate,
} from "../src/features/business/business.validation.js";

const expense = (values = {}) => ({
  id: "expense-1", name: "Rent", category: "RENT", amount: 310, currency: "USD",
  exchangeRateToUsd: 1, amountUsd: 310, recurrence: "monthly", occurrenceDate: null,
  startDate: "2026-01-01", endDate: null, includeInProfit: true, notes: "", ...values,
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

test("expense totals stay at business level and preserve the four-category breakdown", () => {
  const result = expenseSummary([
    expense({ amountUsd: 310, category: "RENT" }),
    expense({ amountUsd: 31, category: "ELECTRICITY" }),
  ], "2026-05-01", "2026-06-01");
  assert.equal(result.totalCosts, 341);
  assert.equal(result.breakdown.length, 4);
});

test("partial-month and partial-year comparisons use equal elapsed periods at the Beirut 06:00 boundary", () => {
  const month = resolveAnalysisPeriods({ period: "monthly", year: 2026, month: 9, businessDate: "2026-09-15", timezone: "Asia/Beirut" });
  assert.equal(month.current.endDateExclusive, "2026-09-16");
  assert.equal(month.previous.startDate, "2026-08-01");
  assert.equal(month.previous.endDateExclusive, "2026-08-16");
  assert.equal(month.current.from, "2026-09-01T03:00:00.000Z");
  const year = resolveAnalysisPeriods({ period: "yearly", year: 2026, businessDate: "2026-09-15", timezone: "Asia/Beirut" });
  assert.equal(year.previous.endDateExclusive, "2025-09-16");
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
  assert.equal(result.averages.status, "available");
  assert.notEqual(result.averages.rolling7DayAverage, null);
  assert.notEqual(result.averages.previousThreeMonthAverage, null);
  assert.equal(result.dataQuality.hasTarget, false);
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
  assert.deepEqual(calls[0], { businessId: "tenant-new", userId: "owner-1", expenseId: null, values: { name: "Rent" } });
});

test("target saving derives expected profit from recorded monthly costs and supports deletion", async () => {
  const calls = [];
  const repository = {
    async listExpenses() { return [expense({ amountUsd: 310 })]; },
    async saveTarget(businessId, userId, targetId, values) {
      calls.push({ operation: "save", businessId, userId, targetId, values });
      return { outcome: "saved", target: { id: "target-1", ...values } };
    },
    async deleteTarget(businessId, userId, targetId) {
      calls.push({ operation: "delete", businessId, userId, targetId });
      return "deleted";
    },
  };
  const service = createBusinessAnalysisService({ repository });
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
  assert.equal(validateTargetUpdate({ params: { targetId: "8ad8b539-1018-4bc0-8fe2-d81566f1de48" }, body: { monthlyTotalTarget: 1000, effectiveFrom: "2026-09-01" } }).success, true);
});
