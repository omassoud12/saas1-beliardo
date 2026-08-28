import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { BUSINESS_DAY_START_HOUR, getBusinessDateKey } from "../../shared/utils/timeRange.js";
import { throwDatabaseError } from "../../shared/utils/database.js";
import { AppError } from "../../shared/errors/AppError.js";

export function isAnalyticsRpcMissing(error) {
  return error?.code === "PGRST202" && error.message?.includes("get_business_analytics");
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
    if (!row.ended_at || !station?.type) continue;
    const businessDate = bucket === "hour" ? null : getBusinessDateKey(row.ended_at, timezone);
    const bucketKey = bucket === "hour"
      ? new Date(row.ended_at).toISOString().slice(0, 16)
      : bucket === "month" ? businessDate.slice(0, 7) : businessDate;
    const key = `${bucketKey}\u0000${station.type}`;
    const current = groups.get(key) ?? {
      bucket_key: bucketKey,
      activity_type: station.type,
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
  id, status, hourly_rate, started_at, paused_at, ended_at,
  total_paused_seconds, final_elapsed_seconds, final_cost,
  station:stations!inner(id, type, number)
`;

const aggregateFallbackFields = `
  ended_at, final_elapsed_seconds, final_cost,
  station:stations!inner(type)
`;

async function aggregateWithoutRpc(businessId, range, bucket, timezone) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseAdmin()
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
    const { data, error } = await getSupabaseAdmin()
      .from("businesses")
      .select("id, name, timezone")
      .eq("id", businessId)
      .single();
    throwDatabaseError(error);
    return data;
  },

  async aggregate(businessId, range, bucket, timezone) {
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

  async findDailySessions(businessId, range) {
    const client = getSupabaseAdmin();
    const [completedResult, openResult] = await Promise.all([
      client.from("sessions")
        .select(detailFields)
        .eq("business_id", businessId)
        .eq("status", "completed")
        .gte("ended_at", range.from)
        .lt("ended_at", range.to)
        .order("ended_at", { ascending: false })
        .limit(250),
      client.from("sessions")
        .select(detailFields)
        .eq("business_id", businessId)
        .in("status", ["active", "paused"])
        .lt("started_at", range.to)
        .order("started_at", { ascending: false })
        .limit(100),
    ]);
    throwDatabaseError(completedResult.error);
    throwDatabaseError(openResult.error);
    return [...(openResult.data ?? []), ...(completedResult.data ?? [])];
  },

  async findConcurrencySessions(businessId, range) {
    const pageSize = 1000;
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await getSupabaseAdmin()
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
};
