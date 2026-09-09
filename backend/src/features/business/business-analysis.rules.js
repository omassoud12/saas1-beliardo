import { compareValues, roundMoney } from "./business-analysis.calculations.js";

function insight(type, code, title, message, evidence) {
  return { type, code, title, message, evidence };
}

export function buildInsights({ financial, previousFinancial, operations, previousOperations, activities, target, statuses, averages, decisionSupport }) {
  const results = [];
  const revenue = compareValues(financial.totalRevenue, previousFinancial.totalRevenue);
  const profit = compareValues(financial.netProfit, previousFinancial.netProfit);
  const costs = compareValues(financial.totalCosts, previousFinancial.totalCosts);
  const sessions = compareValues(operations.completedSessions, previousOperations.completedSessions);
  const currentAverageValue = operations.completedSessions ? financial.totalRevenue / operations.completedSessions : 0;
  const previousAverageValue = previousOperations.completedSessions ? previousFinancial.totalRevenue / previousOperations.completedSessions : 0;
  const averageValue = compareValues(currentAverageValue, previousAverageValue);

  if (revenue.direction === "down" && sessions.direction === "down") {
    results.push(insight("warning", "revenue_and_sessions_down", "Revenue and sessions declined", `Revenue changed by ${revenue.percentageDifference}% while completed sessions changed by ${sessions.percentageDifference}%. Possible driver: fewer sessions.`, { revenue, sessions }));
  } else if (revenue.direction === "down" && sessions.direction === "stable" && averageValue.direction === "down") {
    results.push(insight("warning", "session_value_down", "Average session value declined", `Revenue changed by ${revenue.percentageDifference}% while session volume remained stable. Average session value changed by ${averageValue.percentageDifference}%.`, { revenue, sessions, averageSessionValue: averageValue }));
  }
  if (profit.direction === "down" && revenue.direction === "stable" && costs.direction === "up") {
    results.push(insight("warning", "costs_reduced_profit", "Higher costs reduced profit", `Net profit changed by ${profit.percentageDifference}% while revenue stayed stable and costs changed by ${costs.percentageDifference}%.`, { profit, revenue, costs }));
  }
  if (revenue.direction === "up" && profit.direction === "down") {
    results.push(insight("warning", "costs_outpaced_revenue", "Costs increased faster than revenue", `Revenue increased by ${revenue.percentageDifference}% while net profit changed by ${profit.percentageDifference}%.`, { revenue, profit, costs }));
  }
  for (const activity of activities) {
    if (activity.revenueComparison.direction === "down" && (activity.revenueComparison.percentageDifference ?? 0) <= -10) {
      results.push(insight("warning", "activity_revenue_drop", `${activity.label} revenue declined`, `${activity.label} revenue changed by ${activity.revenueComparison.percentageDifference}% compared with the previous equivalent period.`, { activity: activity.type, revenue: activity.revenueComparison }));
    }
  }
  if (revenue.direction === "up" && profit.direction === "up" && costs.direction === "stable") {
    results.push(insight("positive", "growth_with_stable_costs", "Revenue and profit grew with stable costs", `Revenue changed by ${revenue.percentageDifference}%, net profit by ${profit.percentageDifference}%, and costs by ${costs.percentageDifference}%.`, { revenue, profit, costs }));
  }
  if (statuses.profitability === "profitable" && ["near_target", "below_target"].includes(statuses.target) && target) {
    const remaining = roundMoney(Math.max(0, target.netProfit - financial.netProfit));
    results.push(insight("recommendation", "profit_below_target", "Close the remaining profit gap", `The business is profitable and has reached ${statuses.targetAchievement}% of its selected-period profit target. ${remaining} USD remains.`, { currentProfit: financial.netProfit, targetProfit: target.netProfit, remaining, achievement: statuses.targetAchievement }));
  }
  const fallbackAverageValue = operations.averageSessionValue ?? averages?.averageSessionValue;
  const actionPlan = decisionSupport?.hasTarget ? decisionSupport : target ? {
    hasTarget: true,
    revenueRemaining: roundMoney(Math.max(0, target.revenue - financial.totalRevenue)),
    averageSessionValue: fallbackAverageValue ? roundMoney(fallbackAverageValue) : null,
    requiredSessions: fallbackAverageValue > 0 ? Math.ceil(Math.max(0, target.revenue - financial.totalRevenue) / fallbackAverageValue) : null,
    daysRemaining: null,
    requiredDailyRevenue: null,
  } : null;
  if (actionPlan?.hasTarget && !actionPlan.periodClosed && actionPlan.revenueRemaining > 0) {
    const { revenueRemaining, averageSessionValue, requiredSessions, daysRemaining, requiredDailyRevenue } = actionPlan;
    if (averageSessionValue && requiredSessions !== null) {
      const dailyPlan = Number.isFinite(daysRemaining) && daysRemaining > 0
        ? ` That is about ${requiredDailyRevenue} USD per remaining business day across ${daysRemaining} days.`
        : daysRemaining === 0 ? " The selected period has ended." : "";
      results.push(insight("recommendation", "sessions_to_revenue_target", "Action plan to reach the revenue target", `Approximately ${requiredSessions} additional completed sessions are needed at the current ${averageSessionValue} USD average session value to generate at least ${revenueRemaining} USD.${dailyPlan}`, {
        remainingRevenue: revenueRemaining, averageSessionValue, requiredSessions, daysRemaining, requiredDailyRevenue,
      }));
    }
  }
  if (target && financial.totalRevenue < target.revenue) {
    const remaining = roundMoney(target.revenue - financial.totalRevenue);
    results.push(insight("warning", "revenue_below_target", "Revenue is below target", `Revenue has reached ${roundMoney(financial.totalRevenue / target.revenue * 100)}% of the selected-period target. ${remaining} USD remains.`, { currentRevenue: financial.totalRevenue, targetRevenue: target.revenue, remaining }));
  }
  if (target && financial.profitMargin !== null && financial.profitMargin < target.minimumProfitMargin) {
    const gap = roundMoney(target.minimumProfitMargin - financial.profitMargin);
    results.push(insight("warning", "margin_below_target", "Profit margin is below target", `Profit margin is ${financial.profitMargin}%, which is ${gap} percentage points below the ${target.minimumProfitMargin}% target.`, { currentMargin: financial.profitMargin, targetMargin: target.minimumProfitMargin, gap }));
  }
  if (target?.maximumCosts !== null && target?.maximumCosts !== undefined && financial.totalCosts > target.maximumCosts) {
    const overage = roundMoney(financial.totalCosts - target.maximumCosts);
    results.push(insight("warning", "costs_above_target", "Costs exceed the target ceiling", `Costs are ${overage} USD above the selected-period ceiling of ${target.maximumCosts} USD.`, { currentCosts: financial.totalCosts, maximumCosts: target.maximumCosts, overage }));
  }
  if (!results.some((item) => item.type === "positive") && statuses.profitability === "profitable") {
    results.push(insight("positive", "period_profitable", "The selected period is profitable", `Net profit is ${financial.netProfit} USD with a ${financial.profitMargin}% margin.`, { netProfit: financial.netProfit, profitMargin: financial.profitMargin }));
  }
  if (!results.some((item) => item.type === "warning")) {
    results.push(insight("positive", "no_material_problem", "No material rule-based problem detected", `Revenue is ${financial.totalRevenue} USD, net profit is ${financial.netProfit} USD, and completed sessions total ${operations.completedSessions}.`, { revenue, profit, costs, sessions }));
  }
  if (!results.some((item) => item.type === "recommendation")) {
    results.push(insight("recommendation", "monitor_next_period", "Monitor the next equivalent period", `Track the next period against the current ${financial.totalRevenue} USD revenue and ${operations.completedSessions} completed-session baseline.`, { revenue, profit, sessions }));
  }
  return results;
}
