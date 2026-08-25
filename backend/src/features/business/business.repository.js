import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

const detailFields = `
  id, status, hourly_rate, started_at, paused_at, ended_at,
  total_paused_seconds, final_elapsed_seconds, final_cost,
  station:stations!inner(id, type, number)
`;

export const businessRepository = {
  async aggregate(businessId, range, bucket, timezone) {
    const { data, error } = await getSupabaseAdmin().rpc("get_business_analytics", {
      p_business_id: businessId,
      p_from: range.from,
      p_to: range.to,
      p_bucket: bucket,
      p_timezone: timezone,
    });
    throwDatabaseError(error);
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
        .gte("started_at", range.from)
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
