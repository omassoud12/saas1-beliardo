import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationalKpis, buildPrimaryKpis, buildSecondaryKpis, compactPeriodLabel, partialPeriodLabel, profitCostPresentation, targetProgressPresentation } from "../src/utils/businessKpis.js";
import { startOfWeek } from "../src/utils/analytics.js";

function analysis(values = {}) {
  return {
    period: { kind: "month", isPartial: true },
    financial: { totalRevenue: 1420, totalCosts: 600, netProfit: 820, profitMargin: 57.75, ...values.financial },
    operations: { completedSessions: 84, averageSessionValue: 16.9, averageSessionDurationMinutes: 85, revenuePerHour: 11.93, ...values.operations },
    comparisons: { previousPeriod: {
      totalRevenue: { percentageDifference: 12.3, direction: "up" },
      totalCosts: { percentageDifference: 5, direction: "stable" },
      netProfit: { percentageDifference: -3.1, direction: "stable" },
      profitMargin: { percentageDifference: 2, direction: "stable" },
      completedSessions: { percentageDifference: 6.4, direction: "up" },
    } },
  };
}

test("primary KPI hierarchy uses authoritative values and equivalent-period comparisons", () => {
  const items = buildPrimaryKpis(analysis());
  assert.deepEqual(items.map((item) => item.label), [
    "Actual Revenue", "Actual Expenses", "Actual Net Profit", "Actual Profit Margin", "Completed Sessions",
  ]);
  assert.equal(items[0].value, "$1,420.00");
  assert.equal(items[0].comparison.label, "+12.3% vs previous month's equivalent elapsed period");
  assert.equal(items[1].comparison.tone, "neutral");
  assert.equal(items[2].comparison.label, "-3.1% vs previous month's equivalent elapsed period");
  assert.equal(items[4].value, 84);
});

test("comparison tone follows the backend stability direction", () => {
  const items = buildPrimaryKpis(analysis());
  assert.equal(items[2].comparison.label, "-3.1% vs previous month's equivalent elapsed period");
  assert.equal(items[2].comparison.tone, "neutral");
  assert.equal(items[3].comparison.tone, "neutral");
  assert.equal(items[4].comparison.tone, "positive");
});

test("operational KPIs format session value, duration, and revenue per hour", () => {
  const items = buildOperationalKpis(analysis());
  assert.equal(items[0].value, "$16.90");
  assert.equal(items[1].value, "1h 25m");
  assert.equal(items[2].value, "$11.93");
});

test("secondary efficiency metrics keep sessions and session economics below the primary snapshot", () => {
  const items = buildSecondaryKpis({ ...analysis(), period: { kind: "week", isPartial: true } });
  assert.deepEqual(items.map((item) => item.label), [
    "Completed Sessions", "Average Session Value", "Average Session Duration", "Revenue / Hour",
  ]);
  assert.equal(items[0].value, 84);
  assert.equal(items[0].comparison.label, "+6.4% vs previous week's equivalent elapsed period");
  assert.equal(items[1].value, "$16.90");
  assert.equal(items[2].value, "1h 25m");
  assert.equal(items[3].value, "$11.93");
});

test("zero-revenue and no-expense periods remain valid zero results", () => {
  const items = buildPrimaryKpis(analysis({ financial: { totalRevenue: 0, totalCosts: 0, netProfit: 0, profitMargin: null } }));
  assert.equal(items[0].value, "$0.00");
  assert.equal(items[1].value, "$0.00");
  assert.equal(items[3].value, "—");
});

test("partial labels use the actual API cutoff and historical periods have no label", () => {
  for (const [kind, label] of [["day", "Partial day"], ["week", "Partial week"], ["month", "Partial month"], ["year", "Partial year"]]) {
    assert.match(partialPeriodLabel({ kind, isPartial: true, to: "2026-09-15T11:35:00.000Z", timezone: "Asia/Beirut" }), new RegExp(`^${label} — through 2:35 PM$`));
  }
  assert.equal(partialPeriodLabel({ kind: "month", isPartial: false, to: "2026-09-01T00:00:00Z", timezone: "UTC" }), null);
});

test("snapshot period labels stay compact while preserving current and historical context", () => {
  assert.equal(compactPeriodLabel({
    kind: "day", date: "2026-09-20", businessDate: "2026-09-20", isPartial: true,
    to: "2026-09-20T18:45:00.000Z", timezone: "Asia/Beirut",
  }), "Today · Partial · through 9:45 PM");
  assert.equal(compactPeriodLabel({
    kind: "day", date: "2026-09-19", businessDate: "2026-09-20", isPartial: false,
  }), "Sep 19, 2026");
  assert.equal(compactPeriodLabel({
    kind: "month", year: 2026, month: 9, isPartial: false,
  }), "September 2026");
  assert.equal(compactPeriodLabel({
    kind: "year", year: 2025, isPartial: false,
  }), "2025");
});

test("profit and cost presentation handles profit, no costs, loss, and empty periods", () => {
  assert.deepEqual(profitCostPresentation({ totalRevenue: 100, totalCosts: 40, netProfit: 60, profitMargin: 60 }), {
    revenue: 100, costs: 40, netProfit: 60, profitPercent: 60, costPercent: 40,
    profitBarWidth: 60, costBarWidth: 40, isLoss: false,
  });
  assert.equal(profitCostPresentation({ totalRevenue: 100, totalCosts: 0, netProfit: 100, profitMargin: 100 }).costBarWidth, 0);
  assert.deepEqual(profitCostPresentation({ totalRevenue: 50, totalCosts: 80, netProfit: -30, profitMargin: -60 }), {
    revenue: 50, costs: 80, netProfit: -30, profitPercent: -60, costPercent: 160,
    profitBarWidth: 0, costBarWidth: 100, isLoss: true,
  });
  assert.deepEqual(profitCostPresentation({ totalRevenue: 0, totalCosts: 0, netProfit: 0, profitMargin: null }), {
    revenue: 0, costs: 0, netProfit: 0, profitPercent: null, costPercent: null,
    profitBarWidth: 0, costBarWidth: 0, isLoss: false,
  });
});

test("snapshot target presentation handles missing, active, reached, and exceeded targets", () => {
  assert.deepEqual(targetProgressPresentation(null, 0), {
    hasTarget: false, state: "none", progress: null, barWidth: 0, target: null, remaining: null,
  });
  assert.deepEqual(targetProgressPresentation({ hasTarget: true, fullRevenueTarget: 500, revenueProgress: 49, revenueRemaining: 255 }, 245), {
    hasTarget: true, state: "active", progress: 49, barWidth: 49, target: 500, remaining: 255,
  });
  assert.equal(targetProgressPresentation({ hasTarget: true, fullRevenueTarget: 500, revenueProgress: 100, revenueRemaining: 0 }, 500).state, "reached");
  assert.deepEqual(targetProgressPresentation({ hasTarget: true, fullRevenueTarget: 500, revenueProgress: 130, revenueRemaining: 0 }, 650), {
    hasTarget: true, state: "exceeded", progress: 130, barWidth: 100, target: 500, remaining: 0,
  });
});

test("weekly KPI comparisons identify the equivalent prior-week portion", () => {
  const items = buildPrimaryKpis({ ...analysis(), period: { kind: "week", isPartial: true } });
  assert.equal(items[0].comparison.label, "+12.3% vs previous week's equivalent elapsed period");
});

test("weekly navigation consistently starts on Monday across month and year boundaries", () => {
  assert.equal(startOfWeek("2026-01-01"), "2025-12-29");
  assert.equal(startOfWeek("2026-09-20"), "2026-09-14");
});
