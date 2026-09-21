import { formatCurrency, formatDuration } from "./analytics.js";
import { BUSINESS_COPY } from "../content/businessCopy.js";

function valueOrDash(value, formatter) {
  return value === null || value === undefined ? "—" : formatter(value);
}

export function comparisonDetails(comparison, period, { inverse = false } = {}) {
  if (!comparison) return null;
  const names = { day: "business day", week: "week", month: "month", year: "year" };
  const previous = period?.kind === "day" ? "yesterday" : `previous ${names[period?.kind] ?? "period"}`;
  const baseline = period?.isPartial ? `${previous}'s equivalent elapsed period` : previous;
  const percentage = comparison.percentageDifference;
  if (percentage === null) {
    return { label: `No ${baseline} baseline`, tone: "neutral" };
  }
  const sign = percentage > 0 ? "+" : "";
  const direction = comparison.direction
    ?? (Math.abs(percentage) <= 5 ? "stable" : percentage > 0 ? "up" : "down");
  const favorable = direction === "stable" ? "neutral" : (direction === "up") !== inverse ? "positive" : "negative";
  return {
    label: `${sign}${percentage}% vs ${baseline}`,
    tone: favorable,
  };
}

function cutoffTime(period) {
  if (!period?.isPartial || !period.to) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: period.timezone || "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(period.to));
}

export function compactPeriodLabel(period) {
  if (!period) return "Selected period";
  const cutoff = cutoffTime(period);
  const partial = cutoff ? ` · through ${cutoff}` : "";

  if (period.kind === "day") {
    const label = period.date === period.businessDate
      ? "Today"
      : new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })
        .format(new Date(`${period.date || period.startDate}T12:00:00Z`));
    return `${label}${period.isPartial ? " · Partial" : ""}${partial}`;
  }
  if (period.kind === "month") {
    const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" })
      .format(new Date(Date.UTC(period.year, Number(period.month) - 1, 1)));
    return `${label}${period.isPartial ? " · Partial" : ""}${partial}`;
  }
  if (period.kind === "year") return `${period.year}${period.isPartial ? " · Partial" : ""}${partial}`;
  if (period.kind === "week") {
    const label = period.isPartial ? "This week" : `Week of ${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${period.startDate}T12:00:00Z`))}`;
    return `${label}${period.isPartial ? " · Partial" : ""}${partial}`;
  }
  return period.isPartial ? `Partial period${partial}` : "Selected period";
}

export function profitCostPresentation(financial = {}) {
  const revenue = Number(financial.totalRevenue) || 0;
  const costs = Number(financial.totalCosts) || 0;
  const netProfit = Number(financial.netProfit) || 0;
  const hasMargin = financial.profitMargin !== null && financial.profitMargin !== undefined;
  const margin = Number(financial.profitMargin);
  const profitPercent = revenue > 0 && hasMargin && Number.isFinite(margin) ? margin : null;
  const costPercent = revenue > 0 ? costs / revenue * 100 : null;
  return {
    revenue,
    costs,
    netProfit,
    profitPercent,
    costPercent,
    profitBarWidth: profitPercent === null ? 0 : Math.min(100, Math.max(0, profitPercent)),
    costBarWidth: costPercent === null ? (costs > 0 ? 100 : 0) : Math.min(100, Math.max(0, costPercent)),
    isLoss: netProfit < 0,
  };
}

export function targetProgressPresentation(decisionSupport, revenue) {
  if (!decisionSupport?.hasTarget) {
    return { hasTarget: false, state: "none", progress: null, barWidth: 0, target: null, remaining: null };
  }
  const currentRevenue = Number(revenue) || 0;
  const target = Number(decisionSupport.fullRevenueTarget) || 0;
  const progress = Math.max(0, Number(decisionSupport.revenueProgress) || 0);
  const remaining = Math.max(0, Number(decisionSupport.revenueRemaining) || 0);
  const state = currentRevenue > target ? "exceeded" : remaining <= 0 ? "reached" : "active";
  return {
    hasTarget: true,
    state,
    progress,
    barWidth: Math.min(100, progress),
    target,
    remaining,
  };
}

export function buildPrimaryKpis(data) {
  const { financial, operations, comparisons, period } = data;
  const previous = comparisons.previousPeriod;
  return [
    { key: "revenue", label: "Actual Revenue", value: formatCurrency(financial.totalRevenue), icon: "$", emphasis: true, comparison: comparisonDetails(previous.totalRevenue, period) },
    { key: "expenses", label: "Actual Expenses", value: formatCurrency(financial.totalCosts), icon: "−", comparison: comparisonDetails(previous.totalCosts, period, { inverse: true }) },
    { key: "profit", label: "Actual Net Profit", value: formatCurrency(financial.netProfit), icon: "=", emphasis: true, comparison: comparisonDetails(previous.netProfit, period) },
    { key: "margin", label: "Actual Profit Margin", value: valueOrDash(financial.profitMargin, (value) => `${Number(value).toFixed(2)}%`), icon: "%", comparison: comparisonDetails(previous.profitMargin, period) },
    { key: "sessions", label: BUSINESS_COPY.metrics.completedSessions, value: operations.completedSessions, icon: "✓", comparison: comparisonDetails(previous.completedSessions, period) },
  ];
}

export function buildOperationalKpis(data) {
  const { operations } = data;
  return [
    { key: "session-value", label: BUSINESS_COPY.metrics.averageSessionValue, value: valueOrDash(operations.averageSessionValue, formatCurrency), icon: "$", description: "Revenue per completed session" },
    { key: "session-duration", label: BUSINESS_COPY.metrics.averageSessionDuration, value: valueOrDash(operations.averageSessionDurationMinutes, (minutes) => formatDuration(minutes * 60)), icon: "◷", description: "Average completed usage time" },
    { key: "revenue-hour", label: BUSINESS_COPY.metrics.revenuePerHour, value: valueOrDash(operations.revenuePerHour, formatCurrency), icon: "h", description: "Revenue per completed usage hour—not station pricing" },
  ];
}

export function buildSecondaryKpis(data) {
  return [
    {
      key: "completed-sessions",
      label: BUSINESS_COPY.metrics.completedSessions,
      value: data.operations.completedSessions,
      comparison: comparisonDetails(data.comparisons?.previousPeriod?.completedSessions, data.period),
    },
    ...buildOperationalKpis(data),
  ];
}

export function partialPeriodLabel(period) {
  if (!period?.isPartial || !period.to) return null;
  const kind = { day: "day", week: "week", month: "month", year: "year" }[period.kind] ?? "period";
  const through = cutoffTime(period);
  return `Partial ${kind} — through ${through}`;
}
