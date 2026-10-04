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
  const total = rows.reduce((sum, row) => ({
    sessions: sum.sessions + (Number(row.session_count) || 0),
    totalSeconds: sum.totalSeconds + (Number(row.total_seconds) || 0),
    revenue: sum.revenue + (Number(row.revenue) || 0),
  }), { sessions: 0, totalSeconds: 0, revenue: 0 });
  const sessionDataComplete = !rows.some((row) => row.is_historical && row.row_kind === "revenue" && row.operations_known !== true);
  const durationDataComplete = !rows.some((row) => row.is_historical && row.row_kind === "revenue" && row.duration_known !== true);
  return {
    activities,
    total: finishMetric({ type: "all", label: "All Activities", ...total }),
    dataQuality: { sessionDataComplete, durationDataComplete, includesHistoricalData: rows.some((row) => row.is_historical) },
  };
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

function coverageIncludesKey(coverage, key) {
  if (key.length === 10) return coverage.start <= key && coverage.end >= key;
  const monthStart = `${key}-01`;
  const [year, month] = key.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return coverage.start < monthEnd && coverage.end >= monthStart;
}

function buildBuckets(keys, rows, coverage = []) {
  const groups = groupRows(rows);
  return keys.map((key) => {
    const bucketRows = groups.get(key) ?? [];
    const summary = summarize(bucketRows);
    const historicalCoverageUnknown = bucketRows.length === 0
      && coverage.some((item) => item.mode === "partial" && coverageIncludesKey(item, key));
    return { key, ...summary, dataQuality: { ...summary.dataQuality, historicalCoverageUnknown } };
  });
}

function historicalCoverage(repository, businessId, range) {
  return repository.listHistoricalCoverage ? repository.listHistoricalCoverage(businessId, range) : Promise.resolve([]);
}

function shiftDateKey(date, amount) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function mapSession(row) {
  const station = Array.isArray(row.station) ? row.station[0] : row.station;
  const activity = row.station_type_at_completion ?? station?.type ?? "unknown";
  return {
    id: row.id,
    status: row.status,
    activity,
    activityLabel: activityLabels[activity] ?? "Unknown",
    stationNumber: row.station_number_at_completion ?? station?.number ?? null,
    hourlyRate: Number(row.hourly_rate || 0),
    controllerCount: activity === "playstation" ? (Number(row.controller_count) || 1) : 1,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    endedAt: row.ended_at,
    totalPausedSeconds: Number(row.total_paused_seconds || 0),
    pauseIntervals: Array.isArray(row.pause_intervals) ? row.pause_intervals : [],
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
    async daily({ businessId, timezone, date, page = 1, pageSize = 50, aggregateRange = null }) {
      const range = getDateRange(date, timezone);
      const dataRange = aggregateRange ?? range;
      const [rows, dailyRows, sessionRows, concurrencyRows, coverage] = await Promise.all([
        repository.aggregate(businessId, dataRange, "hour", timezone),
        repository.aggregate(businessId, dataRange, "day", timezone),
        repository.findDailySessions(businessId, range, { page, pageSize }),
        repository.findConcurrencySessions(businessId, range),
        historicalCoverage(repository, businessId, { ...range, startDate: date, endDateExclusive: shiftDateKey(date, 1) }),
      ]);
      const traffic = buildBuckets(getHourlyBucketKeys(range), rows);
      const completed = summarize(dailyRows);
      const historicalCoverageUnknown = dailyRows.length === 0
        && coverage.some((item) => item.mode === "partial" && coverageIncludesKey(item, date));
      const sessionResult = Array.isArray(sessionRows)
        ? { items: sessionRows, total: sessionRows.length, page: 1, pageSize: sessionRows.length || pageSize, hasMore: false }
        : sessionRows;
      const sessions = sessionResult.items.map(mapSession);
      const openSessionCount = sessionResult.openCount ?? sessions.filter((session) => session.status !== "completed").length;
      const peak = traffic.reduce((best, bucket) =>
        bucket.total.sessions > best.sessions
          ? { sessions: bucket.total.sessions, key: bucket.key }
          : best,
      { sessions: 0, key: null });
      return {
        period: { kind: "day", date, businessDate: getBusinessDateKey(clock(), timezone), timezone, currency: defaultCurrency, ...range },
        metrics: {
          totalSessions: completed.dataQuality.sessionDataComplete ? completed.total.sessions + openSessionCount : null,
          completedSessions: completed.dataQuality.sessionDataComplete ? completed.total.sessions : null,
          totalHours: completed.dataQuality.durationDataComplete ? completed.total.hours : null,
          totalSeconds: completed.dataQuality.durationDataComplete ? completed.total.totalSeconds : null,
          revenue: completed.total.revenue,
          peakActivity: peak.sessions,
          peakHour: peak.key,
        },
        activities: completed.activities,
        traffic,
        sessions,
        sessionPagination: { total: sessionResult.total, page: sessionResult.page, pageSize: sessionResult.pageSize, hasMore: sessionResult.hasMore },
        concurrencySessions: concurrencyRows.map(mapSession),
        dataQuality: { ...completed.dataQuality, historicalCoverageUnknown, historicalCoveragePartial: coverage.some((item) => item.mode === "partial") },
      };
    },

    async monthly({ businessId, timezone, year, month, aggregateRange = null }) {
      const range = getMonthRange(year, month, timezone);
      const [rows, coverage] = await Promise.all([
        repository.aggregate(businessId, aggregateRange ?? range, "day", timezone),
        historicalCoverage(repository, businessId, { ...range, startDate: `${year}-${String(month).padStart(2, "0")}-01`, endDateExclusive: month === 12 ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(month) + 1).padStart(2, "0")}-01` }),
      ]);
      const days = buildBuckets(dayKeys(year, month), rows, coverage);
      const summary = summarize(rows);
      return {
        period: { kind: "month", year, month, businessDate: getBusinessDateKey(clock(), timezone), timezone, currency: defaultCurrency, ...range },
        metrics: {
          trackedDays: days.filter((day) => day.total.sessions > 0 || day.total.revenue > 0).length,
          sessionCount: summary.dataQuality.sessionDataComplete ? summary.total.sessions : null,
          totalHours: summary.dataQuality.durationDataComplete ? summary.total.hours : null,
          totalSeconds: summary.dataQuality.durationDataComplete ? summary.total.totalSeconds : null,
          revenue: summary.total.revenue,
        },
        activities: summary.activities,
        days,
        dataQuality: { ...summary.dataQuality, historicalCoveragePartial: coverage.some((item) => item.mode === "partial") },
      };
    },

    async yearly({ businessId, timezone, year, aggregateRange = null }) {
      const range = getYearRange(year, timezone);
      const dataRange = aggregateRange ?? range;
      const [monthRows, dayRows, coverage] = await Promise.all([
        repository.aggregate(businessId, dataRange, "month", timezone),
        repository.aggregate(businessId, dataRange, "day", timezone),
        historicalCoverage(repository, businessId, { ...range, startDate: `${year}-01-01`, endDateExclusive: `${Number(year) + 1}-01-01` }),
      ]);
      const months = buildBuckets(monthKeys(year), monthRows, coverage);
      const summary = summarize(monthRows);
      return {
        period: { kind: "year", year, businessDate: getBusinessDateKey(clock(), timezone), timezone, currency: defaultCurrency, ...range },
        metrics: {
          trackedDays: new Set(dayRows.filter((row) => Number(row.session_count) > 0 || Number(row.revenue) > 0).map((row) => row.bucket_key)).size,
          sessionCount: summary.dataQuality.sessionDataComplete ? summary.total.sessions : null,
          totalHours: summary.dataQuality.durationDataComplete ? summary.total.hours : null,
          totalSeconds: summary.dataQuality.durationDataComplete ? summary.total.totalSeconds : null,
          revenue: summary.total.revenue,
        },
        activities: summary.activities,
        months,
        dataQuality: { ...summary.dataQuality, historicalCoveragePartial: coverage.some((item) => item.mode === "partial") },
      };
    },
  };
}

export const businessService = createBusinessService();
