export const BUSINESS_COPY = Object.freeze({
  modules: [
    ["summary", "Summary · ملخص"],
    ["activity", "Activity · الأنشطة"],
    ["expenses", "Expenses · المصاريف"],
    ["targets", "Targets · الأهداف"],
  ],
  periods: {
    daily: "Daily · يومي",
    weekly: "Weekly · أسبوعي",
    monthly: "Monthly · شهري",
    yearly: "Yearly · سنوي",
  },
  metrics: {
    revenue: "Revenue",
    periodExpenses: "Period expenses",
    netProfit: "Net profit",
    completedSessions: "Completed Sessions",
    averageSessionValue: "Average Session Value",
    averageSessionDuration: "Average Session Duration",
    revenuePerHour: "Revenue / Hour",
  },
  states: {
    noTarget: "No target set",
    targetReached: "Target reached",
    targetExceeded: "Target exceeded",
  },
});
