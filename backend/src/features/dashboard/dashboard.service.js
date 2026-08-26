import { dashboardRepository } from "./dashboard.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import {
  getBucketKey, getDefaultChartRange, getPeriodRange, normalizeBusinessRange,
} from "../../shared/utils/timeRange.js";

function round(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function summarize(sessions) {
  const revenue = sessions.reduce((sum, session) => sum + Number(session.final_cost || 0), 0);
  const totalSeconds = sessions.reduce((sum, session) => sum + Number(session.final_elapsed_seconds || 0), 0);
  const byType = { billiard: 0, pingpong: 0, playstation: 0 };
  for (const session of sessions) {
    const type = session.stations?.type;
    if (type in byType) byType[type] += 1;
  }
  return {
    revenue: round(revenue),
    totalHours: round(totalSeconds / 3600),
    totalSeconds,
    sessionCount: sessions.length,
    averageSessionRevenue: sessions.length ? round(revenue / sessions.length) : 0,
    averageSessionMinutes: sessions.length ? round((totalSeconds / sessions.length) / 60) : 0,
    sessionsByType: byType,
  };
}

export function createDashboardService({ repository = dashboardRepository, clock = () => new Date() } = {}) {
  return {
    async getSummary({ businessId, timezone, period }) {
      const range = getPeriodRange(period, timezone, clock());
      const [sessions, operational] = await Promise.all([
        repository.findCompletedSessions(businessId, range),
        repository.getOperationalCounts(businessId),
      ]);
      return { period, timezone, range, ...summarize(sessions), ...operational };
    },

    async getChart({ businessId, timezone, granularity, from, to }) {
      const now = clock();
      let range = { from, to };
      if (!from && !to) {
        range = getDefaultChartRange(granularity, timezone, now);
      } else {
        range = normalizeBusinessRange(range, timezone);
      }
      if (range.from && range.to && range.from >= range.to) {
        throw new AppError(400, "from must be before to", "INVALID_DATE_RANGE");
      }

      const sessions = await repository.findCompletedSessions(businessId, range);
      const buckets = new Map();
      for (const session of sessions) {
        const key = getBucketKey(session.ended_at, granularity, timezone);
        const bucket = buckets.get(key) ?? { key, revenue: 0, totalSeconds: 0, sessionCount: 0 };
        bucket.revenue += Number(session.final_cost || 0);
        bucket.totalSeconds += Number(session.final_elapsed_seconds || 0);
        bucket.sessionCount += 1;
        buckets.set(key, bucket);
      }

      const data = [...buckets.values()]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((bucket) => ({
          ...bucket,
          revenue: round(bucket.revenue),
          totalHours: round(bucket.totalSeconds / 3600),
        }));
      return { granularity, timezone, range, data };
    },
  };
}

export const dashboardService = createDashboardService();
