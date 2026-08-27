export const SESSION_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

export const OPEN_SESSION_STATUSES = [
  SESSION_STATUS.DRAFT,
  SESSION_STATUS.ACTIVE,
  SESSION_STATUS.PAUSED,
];

export const DASHBOARD_PERIODS = ["today", "week", "month", "year", "all"];
export const CHART_GRANULARITIES = ["daily", "monthly", "yearly"];
