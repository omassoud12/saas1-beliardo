import { AppError } from "../../shared/errors/AppError.js";
import { getBusinessDateKey } from "../../shared/utils/timeRange.js";
import { businessRepository } from "./business.repository.js";
import { businessAnalysisRepository } from "./business-analysis.repository.js";
import {
  activityPerformance, aggregateActivities, calculateStatuses, compareValues,
  daysBetween, expenseSummary, financialSummary, roundMoney, safeRatio, shiftDateKey, targetForPeriod,
} from "./business-analysis.calculations.js";
import { historyRange, resolveAnalysisPeriods } from "./business-analysis.periods.js";
import { buildInsights } from "./business-analysis.rules.js";

function revenueOf(rows) { return roundMoney(rows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0)); }
function sessionsOf(rows) { return rows.reduce((sum, row) => sum + (Number(row.session_count) || 0), 0); }
function secondsOf(rows) { return rows.reduce((sum, row) => sum + (Number(row.total_seconds) || 0), 0); }
function operations(rows, revenue) {
  const completedSessions = sessionsOf(rows);
  const totalSeconds = secondsOf(rows);
  const totalHours = roundMoney(totalSeconds / 3600);
  const buckets = new Map();
  for (const row of rows) buckets.set(row.bucket_key, (buckets.get(row.bucket_key) ?? 0) + (Number(row.session_count) || 0));
  const peak = [...buckets.entries()].reduce((best, [key, sessions]) => sessions > best.sessions ? { key, sessions } : best, { key: null, sessions: 0 });
  return {
    totalSessions: completedSessions,
    completedSessions,
    totalSeconds,
    totalHours,
    averageSessionValue: safeRatio(revenue, completedSessions),
    averageSessionDurationMinutes: safeRatio(totalSeconds, completedSessions, 1 / 60),
    revenuePerHour: safeRatio(revenue, totalHours),
    peakActivity: peak.sessions,
    peakPeriod: peak.key,
  };
}

export function aggregateStationPerformance(rows = []) {
  const labels = { playstation: "PlayStation", billiard: "Billiard", pingpong: "Ping Pong" };
  const stations = new Map();
  let legacyFallbackSessions = 0;
  for (const row of rows) {
    const aggregated = Object.hasOwn(row, "session_count");
    const currentStation = Array.isArray(row.station) ? row.station[0] : row.station;
    const snapshotComplete = aggregated || (row.station_type_at_completion && row.station_number_at_completion !== null
      && row.station_number_at_completion !== undefined);
    if (aggregated) legacyFallbackSessions = Math.max(legacyFallbackSessions, Number(row.legacy_fallback_sessions) || 0);
    else if (!snapshotComplete) legacyFallbackSessions += 1;
    const type = aggregated ? row.activity_type : snapshotComplete ? row.station_type_at_completion : currentStation?.type;
    const stationNumber = aggregated ? row.station_number : snapshotComplete ? row.station_number_at_completion : currentStation?.number;
    if (!type) continue;
    const key = `${type}:${stationNumber ?? "unknown"}`;
    const station = stations.get(key) ?? {
      key, type, stationNumber: stationNumber ?? null,
      station: `${labels[type] ?? type}${stationNumber === null || stationNumber === undefined ? "" : ` ${stationNumber}`}`,
      revenue: 0, completedSessions: 0, totalSeconds: 0,
    };
    station.revenue += Number(aggregated ? row.revenue : row.final_cost) || 0;
    station.completedSessions += aggregated ? Number(row.session_count) || 0 : 1;
    station.totalSeconds += Number(aggregated ? row.total_seconds : row.final_elapsed_seconds) || 0;
    stations.set(key, station);
  }
  return {
    stations: [...stations.values()].map((station) => ({
      ...station,
      revenue: roundMoney(station.revenue),
      averageSessionValue: safeRatio(station.revenue, station.completedSessions),
      averageSessionDurationMinutes: safeRatio(station.totalSeconds, station.completedSessions, 1 / 60),
    })).sort((left, right) => right.revenue - left.revenue || left.station.localeCompare(right.station)),
    dataQuality: { legacyFallbackSessions },
  };
}

function rowsByBucket(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const current = buckets.get(row.bucket_key) ?? { revenue: 0, sessions: 0 };
    current.revenue += Number(row.revenue) || 0;
    current.sessions += Number(row.session_count) || 0;
    buckets.set(row.bucket_key, current);
  }
  return buckets;
}

function trendRecord(key, rows, expenses, startDate, endDateExclusive) {
  const activity = rows.get(key) ?? { revenue: 0, sessions: 0 };
  const costs = expenseSummary(expenses, startDate, endDateExclusive);
  const financial = financialSummary(activity.revenue, costs.totalCosts);
  return {
    key,
    ...financial,
    sessions: activity.sessions,
    expenseCategories: Object.fromEntries(costs.breakdown.map((item) => [item.category, item.amount])),
  };
}

function allocate(total, weights) {
  let assigned = 0;
  return weights.map((weight, index) => {
    const value = index === weights.length - 1 ? roundMoney(total - assigned) : roundMoney(total * weight);
    assigned = roundMoney(assigned + value);
    return value;
  });
}

export function buildFinancialTrend(rows, expenses, range, period) {
  const grouped = rowsByBucket(rows);
  if (period === "daily") {
    const starts = [];
    const from = new Date(range.from).getTime();
    const to = new Date(range.to).getTime();
    for (let value = from; value < to; value += 3600000) starts.push(value);
    if (!starts.length) return [];
    const duration = to - from;
    const weights = starts.map((start) => (Math.min(start + 3600000, to) - start) / duration);
    const costs = expenseSummary(expenses, range.startDate, range.endDateExclusive);
    const totals = Object.fromEntries(costs.breakdown.map((item) => [item.category, allocate(item.amount, weights)]));
    const expenseTotals = allocate(costs.totalCosts, weights);
    return starts.map((start, index) => {
      const key = new Date(start).toISOString();
      const activity = grouped.get(key.slice(0, 16)) ?? { revenue: 0, sessions: 0 };
      const financial = financialSummary(activity.revenue, expenseTotals[index]);
      return {
        key, ...financial, sessions: activity.sessions,
        expenseCategories: Object.fromEntries(Object.entries(totals).map(([category, values]) => [category, values[index]])),
      };
    });
  }

  if (period === "yearly") {
    const result = [];
    for (let start = range.startDate.slice(0, 7); `${start}-01` < range.endDateExclusive;) {
      const startDate = `${start}-01`;
      const endDateExclusive = nextMonthStart(startDate);
      result.push(trendRecord(start, grouped, expenses, startDate,
        endDateExclusive < range.endDateExclusive ? endDateExclusive : range.endDateExclusive));
      start = endDateExclusive.slice(0, 7);
    }
    return result;
  }

  const result = [];
  for (let day = range.startDate; day < range.endDateExclusive; day = shiftDateKey(day, 1)) {
    result.push(trendRecord(day, grouped, expenses, day, shiftDateKey(day, 1)));
  }
  return result;
}

function strongestAndWeakestDays(rows) {
  const days = [...rowsByBucket(rows).entries()]
    .map(([date, values]) => ({ date, revenue: roundMoney(values.revenue), sessions: values.sessions }))
    .filter((day) => day.sessions > 0)
    .sort((left, right) => left.revenue - right.revenue || left.sessions - right.sessions || left.date.localeCompare(right.date));
  return {
    observedDays: days.length,
    strongest: days.length ? days[days.length - 1] : null,
    weakest: days.length ? days[0] : null,
  };
}

function groupByDay(rows) {
  const groups = new Map();
  for (const row of rows) {
    const values = groups.get(row.bucket_key) ?? [];
    values.push(row);
    groups.set(row.bucket_key, values);
  }
  return groups;
}

function average(values) {
  return values.length ? roundMoney(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function buildAverages(rows, expenses, range, currentDays) {
  const grouped = groupByDay(rows);
  const daily = [];
  for (let day = range.startDate; day < range.endDateExclusive; day = shiftDateKey(day, 1)) {
    const dayRows = grouped.get(day) ?? [];
    const revenue = revenueOf(dayRows);
    const costs = expenseSummary(expenses, day, shiftDateKey(day, 1)).totalCosts;
    const sessionCount = sessionsOf(dayRows);
    const hours = roundMoney(secondsOf(dayRows) / 3600);
    daily.push({ day, revenue, costs, profit: roundMoney(revenue - costs), sessionCount, hours });
  }
  const enough = daily.length >= 7;
  const sliceAverage = (count, field) => average(daily.slice(-count).map((item) => item[field]));
  const activeSessions = daily.reduce((sum, item) => sum + item.sessionCount, 0);
  const totalRevenue = daily.reduce((sum, item) => sum + item.revenue, 0);
  const totalHours = daily.reduce((sum, item) => sum + item.hours, 0);
  const dailyRevenue = enough ? average(daily.map((item) => item.revenue)) : null;
  const dailyCosts = enough ? average(daily.map((item) => item.costs)) : null;
  const dailyProfit = enough ? average(daily.map((item) => item.profit)) : null;
  const completedMonths = new Map();
  const selectedMonth = range.endDateExclusive.slice(0, 7);
  for (const item of daily.filter((value) => value.day.slice(0, 7) < selectedMonth)) {
    const key = item.day.slice(0, 7);
    const month = completedMonths.get(key) ?? { revenue: 0, costs: 0, profit: 0 };
    month.revenue += item.revenue;
    month.costs += item.costs;
    month.profit += item.profit;
    completedMonths.set(key, month);
  }
  const priorMonths = [...completedMonths.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-3);
  const previousThreeMonthAverage = priorMonths.length === 3 ? {
    revenue: average(priorMonths.map(([, item]) => item.revenue)),
    costs: average(priorMonths.map(([, item]) => item.costs)),
    netProfit: average(priorMonths.map(([, item]) => item.profit)),
  } : null;
  return {
    status: enough ? "available" : "insufficient_history",
    observedDays: daily.length,
    averageDailyRevenue: dailyRevenue,
    averageDailyCosts: dailyCosts,
    averageDailyNetProfit: dailyProfit,
    averageSessionsPerDay: enough ? average(daily.map((item) => item.sessionCount)) : null,
    averageSessionValue: enough ? safeRatio(totalRevenue, activeSessions) : null,
    averageOperatingHours: enough ? average(daily.map((item) => item.hours)) : null,
    averageRevenuePerHour: enough ? safeRatio(totalRevenue, totalHours) : null,
    rolling7DayAverage: daily.length >= 7 ? sliceAverage(7, "revenue") : null,
    rolling30DayAverage: daily.length >= 30 ? sliceAverage(30, "revenue") : null,
    previousThreeMonthAverage,
    scaledFinancial: enough ? financialSummary(dailyRevenue * currentDays, dailyCosts * currentDays) : null,
  };
}

function comparisonSet(current, previous) {
  return {
    totalRevenue: compareValues(current.totalRevenue, previous.totalRevenue),
    totalCosts: compareValues(current.totalCosts, previous.totalCosts),
    netProfit: compareValues(current.netProfit, previous.netProfit),
    profitMargin: compareValues(current.profitMargin ?? 0, previous.profitMargin ?? 0),
  };
}

function mutationError(outcome, resource) {
  if (outcome === "forbidden") return new AppError(403, `Only an approved owner can manage ${resource}`, "FORBIDDEN");
  if (outcome === "not_found") return new AppError(404, `${resource} record not found`, "NOT_FOUND");
  if (outcome === "conflict") return new AppError(409, `A conflicting ${resource} record exists`, "CONFLICT");
  return new AppError(503, `Unable to save ${resource}`, "MUTATION_FAILED");
}

async function listExpenseHistory(repository, businessId) {
  if (!repository.listExpenseHistory) return repository.listExpenses(businessId);
  if (!repository.listExpenses) return repository.listExpenseHistory(businessId);
  const [active, historical] = await Promise.all([
    repository.listExpenses(businessId),
    repository.listExpenseHistory(businessId),
  ]);
  return [...active, ...historical];
}

function expensesForRange(repository, businessId, startDate, endDateExclusive) {
  return repository.listExpensesForRange
    ? repository.listExpensesForRange(businessId, { startDate, endDateExclusive })
    : listExpenseHistory(repository, businessId);
}

function targetsForRange(repository, businessId, startDate, endDateExclusive) {
  return repository.listTargetsForRange
    ? repository.listTargetsForRange(businessId, { startDate, endDateExclusive })
    : repository.listTargets(businessId);
}

function nextMonthStart(monthStart) {
  const [year, month] = monthStart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 10);
}

function targetMonth(date) {
  return String(date).slice(0, 7);
}

function assertTargetPeriodOpen(target, businessDate) {
  if (targetMonth(target.effectiveFrom) < targetMonth(businessDate)) {
    throw new AppError(409, "Closed-period targets cannot be changed or deleted", "TARGET_PERIOD_CLOSED");
  }
}

function targetWithCurrentCosts(target, expenses) {
  const monthEnd = nextMonthStart(target.effectiveFrom);
  const recordedCostsUsd = expenseSummary(expenses, target.effectiveFrom, monthEnd).totalCosts;
  const calculatedProfitUsd = roundMoney(target.monthlyRevenueTargetUsd - recordedCostsUsd);
  return {
    ...target,
    recordedCostsUsd,
    calculatedProfitUsd,
    costBasisChanged: Math.abs(calculatedProfitUsd - target.monthlyProfitTargetUsd) >= 0.01,
  };
}

function fullPeriodEnd(period, range) {
  if (period === "daily") return range.endDateExclusive;
  if (period === "weekly") return shiftDateKey(range.startDate, 7);
  if (period === "monthly") return nextMonthStart(range.startDate);
  return `${Number(range.startDate.slice(0, 4)) + 1}-01-01`;
}

function currentTargetWithLiveCosts(target, expenses) {
  if (!target) return null;
  const netProfit = roundMoney(target.revenue - expenses.totalCosts);
  return {
    ...target,
    storedNetProfit: target.netProfit,
    netProfit,
    minimumProfitMargin: target.revenue > 0 ? roundMoney(netProfit / target.revenue * 100) : 0,
  };
}

function buildDecisionSupport({ period, range, businessDate, financial, operations, averages, expenses, targets }) {
  const endDateExclusive = fullPeriodEnd(period, range);
  const fullExpenses = expenseSummary(expenses, range.startDate, endDateExclusive);
  const storedFullTarget = targetForPeriod(targets, range.startDate, endDateExclusive);
  if (!storedFullTarget) return {
    hasTarget: false,
    periodClosed: businessDate >= endDateExclusive,
    daysRemaining: businessDate < range.startDate
      ? daysBetween(range.startDate, endDateExclusive)
      : businessDate < endDateExclusive ? daysBetween(businessDate, endDateExclusive) : 0,
  };

  const expectedNetProfit = roundMoney(storedFullTarget.revenue - fullExpenses.totalCosts);
  const revenueRemaining = roundMoney(Math.max(0, storedFullTarget.revenue - financial.totalRevenue));
  const averageSessionValue = operations.averageSessionValue ?? averages.averageSessionValue;
  const daysRemaining = businessDate < range.startDate
    ? daysBetween(range.startDate, endDateExclusive)
    : businessDate < endDateExclusive ? daysBetween(businessDate, endDateExclusive) : 0;
  const targetCostBasis = roundMoney(storedFullTarget.revenue - storedFullTarget.netProfit);
  return {
    hasTarget: true,
    periodClosed: daysRemaining === 0,
    fullRevenueTarget: storedFullTarget.revenue,
    expectedCosts: fullExpenses.totalCosts,
    expectedNetProfit,
    revenueProgress: safeRatio(financial.totalRevenue, storedFullTarget.revenue, 100),
    revenueRemaining,
    daysRemaining,
    requiredDailyRevenue: daysRemaining > 0 ? roundMoney(revenueRemaining / daysRemaining) : null,
    averageSessionValue: averageSessionValue ? roundMoney(averageSessionValue) : null,
    requiredSessions: averageSessionValue > 0 ? Math.ceil(revenueRemaining / averageSessionValue) : null,
    costBasisChanged: Math.abs(targetCostBasis - fullExpenses.totalCosts) >= 0.01,
    targetCostBasis,
  };
}

export function createBusinessAnalysisService({
  summaries = businessRepository,
  repository = businessAnalysisRepository,
  clock = () => new Date(),
} = {}) {
  return {
    async analyze({ businessId, timezone, period, date, year, month }) {
      const now = clock();
      const businessDate = getBusinessDateKey(now, timezone);
      const periods = resolveAnalysisPeriods({ period, date, year, month, businessDate, timezone, now });
      const business = await summaries.findBusiness(businessId);
      if (!business) throw new AppError(404, "Business not found", "BUSINESS_NOT_FOUND");
      const createdDate = getBusinessDateKey(new Date(business.created_at ?? "2000-01-01T00:00:00Z"), timezone);
      const history = historyRange(periods.current.startDate, createdDate, timezone);
      const dataStartDate = [periods.previous.startDate, periods.current.startDate, history.startDate].sort()[0];
      const dataEndDateExclusive = fullPeriodEnd(period, periods.current);
      const [currentRows, previousRows, historyRows, expenses, targets, separateTrendRows, cancelledSessions] = await Promise.all([
        summaries.aggregate(businessId, periods.current, "day", timezone),
        summaries.aggregate(businessId, periods.previous, "day", timezone),
        history.days ? summaries.aggregate(businessId, history, "day", timezone) : [],
        expensesForRange(repository, businessId, dataStartDate, dataEndDateExclusive),
        targetsForRange(repository, businessId, dataStartDate, dataEndDateExclusive),
        ["daily", "yearly"].includes(period)
          ? summaries.aggregate(businessId, periods.current, period === "daily" ? "hour" : "month", timezone)
          : null,
        summaries.countCancelled ? summaries.countCancelled(businessId, periods.current) : 0,
      ]);
      const currentExpense = expenseSummary(expenses, periods.current.startDate, periods.current.endDateExclusive);
      const previousExpense = expenseSummary(expenses, periods.previous.startDate, periods.previous.endDateExclusive);
      const financial = financialSummary(revenueOf(currentRows), currentExpense.totalCosts);
      const previousFinancial = financialSummary(revenueOf(previousRows), previousExpense.totalCosts);
      const currentOperations = operations(currentRows, financial.totalRevenue);
      currentOperations.cancelledSessions = Number(cancelledSessions) || 0;
      currentOperations.cancellationRate = safeRatio(
        currentOperations.cancelledSessions,
        currentOperations.completedSessions + currentOperations.cancelledSessions,
        100,
      );
      const previousOperations = operations(previousRows, previousFinancial.totalRevenue);
      const averages = buildAverages(historyRows, expenses, history, periods.current.days);
      const storedTarget = targetForPeriod(targets, periods.current.startDate, periods.current.endDateExclusive);
      const target = currentTargetWithLiveCosts(storedTarget, currentExpense);
      const statuses = calculateStatuses(financial, previousFinancial, target);
      if (financial.totalRevenue === 0 && currentExpense.totalCosts === 0 && currentOperations.completedSessions === 0) statuses.overall = "gray";
      const activities = activityPerformance(currentRows, previousRows);
      const decisionSupport = buildDecisionSupport({
        period, range: periods.current, businessDate, financial, operations: currentOperations,
        averages, expenses, targets,
      });
      const insights = buildInsights({
        financial, previousFinancial, operations: currentOperations, previousOperations,
        activities, target, statuses, averages, decisionSupport,
      });
      const trendRows = separateTrendRows ?? currentRows;
      return {
        period: { selected: period, businessDate, timezone, currency: "USD", ...periods.current },
        financial,
        operations: currentOperations,
        trend: buildFinancialTrend(trendRows, expenses, periods.current, period),
        businessDays: strongestAndWeakestDays(currentRows),
        activities,
        expenses: currentExpense,
        averages,
        comparisons: {
          previousPeriod: {
            ...comparisonSet(financial, previousFinancial),
            completedSessions: compareValues(currentOperations.completedSessions, previousOperations.completedSessions),
          },
          historicalAverage: averages.scaledFinancial ? comparisonSet(financial, averages.scaledFinancial) : null,
          target: target ? {
            values: target,
            revenue: compareValues(financial.totalRevenue, target.revenue),
            netProfit: compareValues(financial.netProfit, target.netProfit),
          } : null,
        },
        statuses,
        decisionSupport,
        insights,
        dataQuality: {
          hasEnoughHistory: averages.status === "available",
          hasTarget: Boolean(target),
          targetCostBasisChanged: Boolean(decisionSupport.costBasisChanged),
        },
      };
    },

    listExpenses(businessId) { return repository.listExpenses(businessId); },
    listExpenseHistory(businessId) { return listExpenseHistory(repository, businessId); },
    listExpensePage(businessId, pagination, history = false) {
      return repository.listExpensePage(businessId, { ...pagination, history });
    },
    async stationPerformance({ businessId, timezone, period, date, year, month }) {
      const now = clock();
      const businessDate = getBusinessDateKey(now, timezone);
      const periods = resolveAnalysisPeriods({ period, date, year, month, businessDate, timezone, now });
      const business = await summaries.findBusiness(businessId);
      if (!business) throw new AppError(404, "Business not found", "BUSINESS_NOT_FOUND");
      const rows = summaries.findStationPerformance
        ? await summaries.findStationPerformance(businessId, periods.current)
        : await summaries.findStationPerformanceSessions(businessId, periods.current);
      return {
        period: { selected: period, businessDate, timezone, currency: "USD", ...periods.current },
        ...aggregateStationPerformance(rows),
      };
    },
    async saveExpense({ businessId, userId, timezone = "UTC", expenseId = null, values }) {
      const effectiveDate = getBusinessDateKey(clock(), timezone);
      const result = await repository.saveExpense(businessId, userId, expenseId, { ...values, effectiveDate });
      if (result.outcome !== "saved") throw mutationError(result.outcome, "expense");
      return result.expense;
    },
    async deleteExpense({ businessId, userId, timezone = "UTC", expenseId }) {
      const effectiveDate = getBusinessDateKey(clock(), timezone);
      const outcome = await repository.deleteExpense(businessId, userId, expenseId, effectiveDate);
      if (outcome !== "deleted") throw mutationError(outcome, "expense");
    },
    async listTargets(businessId) {
      const [targets, expenses] = await Promise.all([
        repository.listTargets(businessId), listExpenseHistory(repository, businessId),
      ]);
      return targets.map((target) => targetWithCurrentCosts(target, expenses));
    },
    async listTargetPage(businessId, pagination) {
      const result = await repository.listTargetPage(businessId, pagination);
      if (!result.items.length) return result;
      const startDate = result.items.map((target) => target.effectiveFrom).sort()[0];
      const endDateExclusive = nextMonthStart(result.items.map((target) => target.effectiveFrom).sort().at(-1));
      const expenses = await expensesForRange(repository, businessId, startDate, endDateExclusive);
      return { ...result, items: result.items.map((target) => targetWithCurrentCosts(target, expenses)) };
    },
    async saveTarget({ businessId, userId, timezone = "UTC", targetId = null, values }) {
      const businessDate = getBusinessDateKey(clock(), timezone);
      assertTargetPeriodOpen({ effectiveFrom: values.effectiveFrom }, businessDate);
      if (targetId) {
        const existing = await repository.findTarget(businessId, targetId);
        if (!existing) throw mutationError("not_found", "target");
        assertTargetPeriodOpen(existing, businessDate);
      }
      const monthEnd = nextMonthStart(values.effectiveFrom);
      const expenses = await expensesForRange(repository, businessId, values.effectiveFrom, monthEnd);
      const monthlyCosts = expenseSummary(expenses, values.effectiveFrom, monthEnd).totalCosts;
      const monthlyProfitTarget = roundMoney(values.monthlyTotalTarget - monthlyCosts);
      if (monthlyProfitTarget <= 0) {
        throw new AppError(400, `Total target must be greater than the ${monthlyCosts} USD recorded monthly costs`, "TARGET_BELOW_COSTS", { monthlyCosts });
      }
      const targetValues = {
        monthlyRevenueTarget: values.monthlyTotalTarget,
        monthlyProfitTarget,
        minimumProfitMargin: roundMoney(monthlyProfitTarget / values.monthlyTotalTarget * 100),
        maximumMonthlyCosts: null,
        currency: "USD",
        exchangeRateToUsd: 1,
        effectiveFrom: values.effectiveFrom,
      };
      const result = await repository.saveTarget(businessId, userId, targetId, targetValues);
      if (result.outcome !== "saved") throw mutationError(result.outcome, "target");
      return result.target;
    },
    async deleteTarget({ businessId, userId, timezone = "UTC", targetId }) {
      const businessDate = getBusinessDateKey(clock(), timezone);
      const existing = await repository.findTarget(businessId, targetId);
      if (!existing) throw mutationError("not_found", "target");
      assertTargetPeriodOpen(existing, businessDate);
      const outcome = await repository.deleteTarget(businessId, userId, targetId);
      if (outcome !== "deleted") throw mutationError(outcome, "target");
    },
  };
}

export const businessAnalysisService = createBusinessAnalysisService();
