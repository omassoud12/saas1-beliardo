import { businessRepository } from "./business.repository.js";
import {
  getBusinessDateKey, getDateRange, getHourlyBucketKeys, getMonthRange, getYearRange,
} from "../../shared/utils/timeRange.js";

const activityTypes = ["playstation", "billiard", "pingpong"];
const activityLabels = {
  playstation: "PlayStation",
  billiard: "Billiard",
  pingpong: "Ping Pong",
};
const defaultCurrency = "USD";

function round(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round(Number(value || 0) * multiplier) / multiplier;
}

function emptyActivity(type) {
  return { type, label: activityLabels[type], sessions: 0, totalSeconds: 0, hours: 0, revenue: 0 };
}

function addRow(target, row) {
  target.sessions += Number(row.session_count || 0);
  target.totalSeconds += Number(row.total_seconds || 0);
  target.revenue += Number(row.revenue || 0);
}

function finishMetric(metric) {
  return { ...metric, hours: round(metric.totalSeconds / 3600), revenue: round(metric.revenue) };
}

function summarize(rows) {
  const map = Object.fromEntries(activityTypes.map((type) => [type, emptyActivity(type)]));
  for (const row of rows) {
    if (map[row.activity_type]) addRow(map[row.activity_type], row);
  }
  const activities = activityTypes.map((type) => finishMetric(map[type]));
  const total = activities.reduce((sum, activity) => ({
    sessions: sum.sessions + activity.sessions,
    totalSeconds: sum.totalSeconds + activity.totalSeconds,
    revenue: sum.revenue + activity.revenue,
  }), { sessions: 0, totalSeconds: 0, revenue: 0 });
  return { activities, total: finishMetric({ type: "all", label: "All Activities", ...total }) };
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.bucket_key) continue;
    const group = groups.get(row.bucket_key) ?? [];
    group.push(row);
    groups.set(row.bucket_key, group);
  }
  return groups;
}

function buildBuckets(keys, rows) {
  const groups = groupRows(rows);
  return keys.map((key) => ({ key, ...summarize(groups.get(key) ?? []) }));
}

function mapSession(row) {
  const station = Array.isArray(row.station) ? row.station[0] : row.station;
  return {
    id: row.id,
    status: row.status,
    activity: station?.type ?? "unknown",
    activityLabel: activityLabels[station?.type] ?? "Unknown",
    stationNumber: station?.number ?? null,
    hourlyRate: Number(row.hourly_rate || 0),
    controllerCount: station?.type === "playstation" ? (Number(row.controller_count) || 1) : 1,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    endedAt: row.ended_at,
    totalPausedSeconds: Number(row.total_paused_seconds || 0),
    durationSeconds: Number(row.final_elapsed_seconds || 0),
    revenue: Number(row.final_cost || 0),
  };
}

function monthKeys(year) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

function dayKeys(year, month) {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) =>
    `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
}

export function createBusinessService({ repository = businessRepository, clock = () => new Date() } = {}) {
  return {
    async daily({ businessId, timezone, date }) {
      const range = getDateRange(date, timezone);
      const [rows, sessionRows, concurrencyRows] = await Promise.all([
        repository.aggregate(businessId, range, "hour", timezone),
        repository.findDailySessions(businessId, range),
        repository.findConcurrencySessions(businessId, range),
      ]);
      const traffic = buildBuckets(getHourlyBucketKeys(range), rows);
      const completed = summarize(rows);
      const sessions = sessionRows.map(mapSession);
      const openSessionCount = sessions.filter((session) => session.status !== "completed").length;
      const peak = traffic.reduce((best, bucket) =>
        bucket.total.sessions > best.sessions
          ? { sessions: bucket.total.sessions, key: bucket.key }
          : best,
      { sessions: 0, key: null });
      return {
        period: { kind: "day", date, businessDate: getBusinessDateKey(clock(), timezone), timezone, currency: defaultCurrency, ...range },
        metrics: {
          totalSessions: completed.total.sessions + openSessionCount,
          completedSessions: completed.total.sessions,
          totalHours: completed.total.hours,
          totalSeconds: completed.total.totalSeconds,
          revenue: completed.total.revenue,
          peakActivity: peak.sessions,
          peakHour: peak.key,
        },
        activities: completed.activities,
        traffic,
        sessions,
        concurrencySessions: concurrencyRows.map(mapSession),
      };
    },

    async monthly({ businessId, timezone, year, month }) {
      const range = getMonthRange(year, month, timezone);
      const rows = await repository.aggregate(businessId, range, "day", timezone);
      const days = buildBuckets(dayKeys(year, month), rows);
      const summary = summarize(rows);
      return {
        period: { kind: "month", year, month, businessDate: getBusinessDateKey(clock(), timezone), timezone, currency: defaultCurrency, ...range },
        metrics: {
          trackedDays: days.filter((day) => day.total.sessions > 0).length,
          sessionCount: summary.total.sessions,
          totalHours: summary.total.hours,
          totalSeconds: summary.total.totalSeconds,
          revenue: summary.total.revenue,
        },
        activities: summary.activities,
        days,
      };
    },

    async yearly({ businessId, timezone, year }) {
      const range = getYearRange(year, timezone);
      const [monthRows, dayRows] = await Promise.all([
        repository.aggregate(businessId, range, "month", timezone),
        repository.aggregate(businessId, range, "day", timezone),
      ]);
      const months = buildBuckets(monthKeys(year), monthRows);
      const summary = summarize(monthRows);
      return {
        period: { kind: "year", year, businessDate: getBusinessDateKey(clock(), timezone), timezone, currency: defaultCurrency, ...range },
        metrics: {
          trackedDays: new Set(dayRows.filter((row) => Number(row.session_count) > 0).map((row) => row.bucket_key)).size,
          sessionCount: summary.total.sessions,
          totalHours: summary.total.hours,
          totalSeconds: summary.total.totalSeconds,
          revenue: summary.total.revenue,
        },
        activities: summary.activities,
        months,
      };
    },
  };
}

export const businessService = createBusinessService();
