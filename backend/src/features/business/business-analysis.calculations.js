export const STABILITY_THRESHOLD_PERCENT = 5;

export function roundMoney(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
}

export function safeRatio(numerator, denominator, multiplier = 1) {
  const bottom = Number(denominator);
  if (!Number.isFinite(bottom) || bottom === 0) return null;
  return roundMoney((Number(numerator) || 0) / bottom * multiplier);
}

export function convertToUsd(amount, currency, exchangeRateToUsd = 1) {
  const value = Number(amount);
  const rate = Number(exchangeRateToUsd);
  if (!Number.isFinite(value) || value < 0 || !Number.isFinite(rate) || rate <= 0) return null;
  return roundMoney(currency === "LBP" ? value / rate : value);
}

export function compareValues(currentValue, previousValue, threshold = STABILITY_THRESHOLD_PERCENT) {
  const current = roundMoney(currentValue);
  const previous = roundMoney(previousValue);
  const absoluteDifference = roundMoney(current - previous);
  const percentageDifference = previous === 0
    ? (current === 0 ? 0 : null)
    : roundMoney(absoluteDifference / Math.abs(previous) * 100);
  const direction = Math.abs(percentageDifference ?? (absoluteDifference === 0 ? 0 : threshold + 1)) <= threshold
    ? "stable"
    : absoluteDifference > 0 ? "up" : "down";
  return { current, previous, absoluteDifference, percentageDifference, direction };
}

export function financialSummary(totalRevenue, totalCosts) {
  const revenue = roundMoney(totalRevenue);
  const costs = roundMoney(totalCosts);
  const netProfit = roundMoney(revenue - costs);
  return {
    totalRevenue: revenue,
    totalCosts: costs,
    netProfit,
    profitMargin: safeRatio(netProfit, revenue, 100),
  };
}

export function aggregateActivities(rows = []) {
  const labels = { playstation: "PlayStation", billiard: "Billiard", pingpong: "Ping Pong" };
  const order = ["playstation", "billiard", "pingpong"];
  const map = new Map(order.map((type) => [type, {
    type, label: labels[type], sessions: 0, totalSeconds: 0, hours: 0, revenue: 0,
  }]));
  for (const row of rows) {
    const type = row.activity_type;
    if (!type) continue;
    if (!map.has(type)) map.set(type, {
      type, label: String(type).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      sessions: 0, totalSeconds: 0, hours: 0, revenue: 0,
    });
    const activity = map.get(type);
    activity.sessions += Number(row.session_count) || 0;
    activity.totalSeconds += Number(row.total_seconds) || 0;
    activity.revenue += Number(row.revenue) || 0;
  }
  return [...map.values()].map((activity) => ({
    ...activity,
    hours: roundMoney(activity.totalSeconds / 3600),
    revenue: roundMoney(activity.revenue),
  }));
}

export function activityPerformance(currentRows, previousRows) {
  const current = aggregateActivities(currentRows);
  const previous = new Map(aggregateActivities(previousRows).map((item) => [item.type, item]));
  const totalRevenue = current.reduce((sum, item) => sum + item.revenue, 0);
  return current.map((activity) => {
    const prior = previous.get(activity.type) ?? { revenue: 0 };
    return {
      ...activity,
      averageSessionValue: safeRatio(activity.revenue, activity.sessions),
      averageSessionDurationMinutes: safeRatio(activity.totalSeconds, activity.sessions, 1 / 60),
      revenuePerHour: safeRatio(activity.revenue, activity.hours),
      revenueShare: safeRatio(activity.revenue, totalRevenue, 100),
      revenueComparison: compareValues(activity.revenue, prior.revenue),
    };
  });
}

function dateValue(value) {
  return new Date(`${value}T12:00:00Z`);
}

export function shiftDateKey(value, days) {
  const date = dateValue(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(startDate, endDateExclusive) {
  return Math.max(0, Math.round((dateValue(endDateExclusive) - dateValue(startDate)) / 86400000));
}

function laterDate(left, right) { return left > right ? left : right; }
function earlierDate(left, right) { return left < right ? left : right; }

function activeOverlap(expense, startDate, endDateExclusive) {
  const activeStart = laterDate(startDate, expense.startDate);
  const activeEnd = expense.endDate
    ? earlierDate(endDateExclusive, shiftDateKey(expense.endDate, 1))
    : endDateExclusive;
  return activeEnd > activeStart ? { startDate: activeStart, endDateExclusive: activeEnd } : null;
}

function monthDays(dateKey) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function yearDays(dateKey) {
  const year = Number(dateKey.slice(0, 4));
  return (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
}

export function expenseCostForPeriod(expense, startDate, endDateExclusive) {
  if (!expense.includeInProfit) return 0;
  const amount = Number(expense.amountUsd) || 0;
  if (expense.recurrence === "one_time") {
    return expense.occurrenceDate >= startDate && expense.occurrenceDate < endDateExclusive ? roundMoney(amount) : 0;
  }
  const overlap = activeOverlap(expense, startDate, endDateExclusive);
  if (!overlap) return 0;
  let total = 0;
  for (let day = overlap.startDate; day < overlap.endDateExclusive; day = shiftDateKey(day, 1)) {
    if (expense.recurrence === "weekly") total += amount / 7;
    else if (expense.recurrence === "monthly") total += amount / monthDays(day);
    else if (expense.recurrence === "yearly") total += amount / yearDays(day);
  }
  return roundMoney(total);
}

export function expenseSummary(expenses, startDate, endDateExclusive) {
  const categoryTotals = { RENT: 0, ELECTRICITY: 0, EMPLOYEES: 0, OTHER: 0 };
  const records = expenses.map((expense) => ({
    ...expense,
    periodCost: expenseCostForPeriod(expense, startDate, endDateExclusive),
  }));
  for (const expense of records) {
    if (expense.includeInProfit) categoryTotals[expense.category] += expense.periodCost;
  }
  const breakdown = Object.entries(categoryTotals).map(([category, amount]) => ({ category, amount: roundMoney(amount) }));
  return {
    totalCosts: roundMoney(breakdown.reduce((sum, item) => sum + item.amount, 0)),
    breakdown,
    records: records.filter((expense) => expense.periodCost > 0),
  };
}

function applicableTarget(targets, dateKey) {
  return [...targets]
    .filter((target) => target.effectiveFrom <= dateKey)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom) || right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

export function targetForPeriod(targets, startDate, endDateExclusive) {
  let revenue = 0;
  let profit = 0;
  let maximumCosts = 0;
  let hasMaximumCosts = false;
  let lastTarget = null;
  for (let day = startDate; day < endDateExclusive; day = shiftDateKey(day, 1)) {
    const target = applicableTarget(targets, day);
    if (!target) continue;
    lastTarget = target;
    const divisor = monthDays(day);
    revenue += target.monthlyRevenueTargetUsd / divisor;
    profit += target.monthlyProfitTargetUsd / divisor;
    if (target.maximumMonthlyCostsUsd !== null) {
      maximumCosts += target.maximumMonthlyCostsUsd / divisor;
      hasMaximumCosts = true;
    }
  }
  if (!lastTarget) return null;
  return {
    id: lastTarget.id,
    currency: "USD",
    revenue: roundMoney(revenue),
    netProfit: roundMoney(profit),
    minimumProfitMargin: lastTarget.minimumProfitMargin,
    maximumCosts: hasMaximumCosts ? roundMoney(maximumCosts) : null,
    effectiveFrom: lastTarget.effectiveFrom,
  };
}

export function calculateStatuses(financial, previousFinancial, target) {
  const profitability = financial.netProfit > 0 ? "profitable" : financial.netProfit < 0 ? "loss" : "break_even";
  const trendComparison = compareValues(financial.netProfit, previousFinancial.netProfit);
  const trend = trendComparison.direction === "up" ? "growing" : trendComparison.direction === "down" ? "declining" : "stable";
  const achievement = target?.netProfit > 0 ? safeRatio(financial.netProfit, target.netProfit, 100) : null;
  const meetsSupportingTargets = !target || (
    (financial.profitMargin ?? -Infinity) >= target.minimumProfitMargin
    && (target.maximumCosts === null || financial.totalCosts <= target.maximumCosts)
    && financial.totalRevenue >= target.revenue
  );
  const targetStatus = !target ? "no_target" : achievement !== null && achievement >= 100 && meetsSupportingTargets
    ? "achieved" : achievement !== null && achievement >= 80 && meetsSupportingTargets ? "near_target" : "below_target";
  const overall = profitability === "loss" ? "red"
    : profitability === "break_even" ? "yellow"
      : targetStatus === "achieved" && trend !== "declining" ? "green" : "yellow";
  return { profitability, trend, target: targetStatus, overall, targetAchievement: achievement };
}
