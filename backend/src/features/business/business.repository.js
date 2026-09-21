import { getSupabaseDataClient } from "../../middleware/requestContext.js";
import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { BUSINESS_DAY_START_HOUR, getBusinessDateKey } from "../../shared/utils/timeRange.js";
import { throwDatabaseError } from "../../shared/utils/database.js";
import { AppError } from "../../shared/errors/AppError.js";

export function isAnalyticsRpcMissing(error) {
  return error?.code === "PGRST202" && error.message?.includes("get_business_analytics");
}

export function isStationPerformanceRpcMissing(error) {
  return error?.code === "PGRST202" && error.message?.includes("get_business_station_performance");
}

export function throwBusinessDatabaseError(error) {
  if (isAnalyticsRpcMissing(error)) {
    throw new AppError(503, "Business analytics database function is unavailable", "ANALYTICS_SCHEMA_OUTDATED");
  }
  throwDatabaseError(error);
}

export function aggregateSessionRows(rows, bucket, timezone) {
  const groups = new Map();
  for (const row of rows) {
    const station = Array.isArray(row.station) ? row.station[0] : row.station;
    const activityType = row.station_type_at_completion ?? station?.type;
    if (!row.ended_at || !activityType) continue;
    const businessDate = bucket === "hour" ? null : getBusinessDateKey(row.ended_at, timezone);
    const bucketKey = bucket === "hour"
      ? new Date(row.ended_at).toISOString().slice(0, 16)
      : bucket === "month" ? businessDate.slice(0, 7) : businessDate;
    const key = `${bucketKey}\u0000${activityType}`;
    const current = groups.get(key) ?? {
      bucket_key: bucketKey,
      activity_type: activityType,
      session_count: 0,
      total_seconds: 0,
      revenue: 0,
    };
    current.session_count += 1;
    current.total_seconds += Number(row.final_elapsed_seconds || 0);
    current.revenue += Number(row.final_cost || 0);
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) =>
    left.bucket_key.localeCompare(right.bucket_key) || left.activity_type.localeCompare(right.activity_type));
}

const detailFields = `
  id, status, hourly_rate, controller_count, started_at, paused_at, ended_at,
  total_paused_seconds, final_elapsed_seconds, final_cost, pause_intervals,
  station_type_at_completion, station_number_at_completion,
  station:stations!inner(id, type, number)
`;

const aggregateFallbackFields = `
  ended_at, final_elapsed_seconds, final_cost, station_type_at_completion,
  station:stations!inner(type)
`;

async function aggregateWithoutRpc(businessId, range, bucket, timezone) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseDataClient()
      .from("sessions")
      .select(aggregateFallbackFields)
      .eq("business_id", businessId)
      .eq("status", "completed")
      .gte("ended_at", range.from)
      .lt("ended_at", range.to)
      .order("ended_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    throwDatabaseError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return aggregateSessionRows(rows, bucket, timezone);
}

export const businessRepository = {
  async findBusiness(businessId) {
    const { data, error } = await getSupabaseDataClient()
      .from("businesses")
      .select("id, name, timezone, created_at")
      .eq("id", businessId)
      .single();
    throwDatabaseError(error);
    return data;
  },

  async aggregate(businessId, range, bucket, timezone) {
    // This RPC is intentionally executable by service_role only. The caller's
    // tenant is resolved by authentication before it reaches this repository.
    const { data, error } = await getSupabaseAdmin().rpc("get_business_analytics", {
      p_business_id: businessId,
      p_from: range.from,
      p_to: range.to,
      p_bucket: bucket,
      p_timezone: timezone,
      p_business_day_start_hour: BUSINESS_DAY_START_HOUR,
    });
    if (isAnalyticsRpcMissing(error)) {
      return aggregateWithoutRpc(businessId, range, bucket, timezone);
    }
    throwBusinessDatabaseError(error);
    return data ?? [];
  },

  async findDailySessions(businessId, range, { page = 1, pageSize = 50 } = {}) {
    const offset = (page - 1) * pageSize;
    const filter = `and(status.eq.completed,ended_at.gte.${range.from},ended_at.lt.${range.to}),and(status.in.(active,paused),started_at.lt.${range.to})`;
    const client = getSupabaseDataClient();
    const [pageResult, openResult] = await Promise.all([
      client.from("sessions")
        .select(detailFields, { count: "exact" })
        .eq("business_id", businessId)
        .or(filter)
        .order("started_at", { ascending: false })
        .range(offset, offset + pageSize - 1),
      client.from("sessions").select("id", { count: "exact", head: true })
        .eq("business_id", businessId).in("status", ["active", "paused"]).lt("started_at", range.to),
    ]);
    throwDatabaseError(pageResult.error);
    throwDatabaseError(openResult.error);
    const { data, count } = pageResult;
    const total = count ?? 0;
    return { items: data ?? [], total, page, pageSize, hasMore: offset + (data?.length ?? 0) < total, openCount: openResult.count ?? 0 };
  },

  async findConcurrencySessions(businessId, range) {
    const pageSize = 1000;
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await getSupabaseDataClient()
        .from("sessions")
        .select(detailFields)
        .eq("business_id", businessId)
        .in("status", ["active", "paused", "completed"])
        .lt("started_at", range.to)
        .or(`ended_at.gte.${range.from},ended_at.is.null`)
        .order("started_at", { ascending: true })
        .range(offset, offset + pageSize - 1);
      throwDatabaseError(error);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  },

  async countCancelled(businessId, range) {
    const { count, error } = await getSupabaseDataClient()
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "cancelled")
      .gte("cancelled_at", range.from)
      .lt("cancelled_at", range.to);
    throwDatabaseError(error);
    return count ?? 0;
  },

  async findStationPerformanceSessions(businessId, range) {
    const pageSize = 1000;
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await getSupabaseDataClient()
        .from("sessions")
        .select("ended_at, final_cost, final_elapsed_seconds, station_type_at_completion, station_number_at_completion, station:stations!inner(type, number)")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .gte("ended_at", range.from)
        .lt("ended_at", range.to)
        .order("ended_at", { ascending: true })
        .range(offset, offset + pageSize - 1);
      throwDatabaseError(error);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  },

  async findStationPerformance(businessId, range) {
    const { data, error } = await getSupabaseAdmin().rpc("get_business_station_performance", {
      p_business_id: businessId,
      p_from: range.from,
      p_to: range.to,
    });
    if (isStationPerformanceRpcMissing(error)) {
      return this.findStationPerformanceSessions(businessId, range);
    }
    throwDatabaseError(error);
    return data ?? [];
  },
};
