import { getSupabaseDataClient } from "../../middleware/requestContext.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

export const dashboardRepository = {
  async findCompletedSessions(businessId, { from, to }) {
    const pageSize = 1000;
    const rows = [];
    let page = 0;

    while (true) {
      let query = getSupabaseDataClient()
        .from("sessions")
        .select("id, station_id, hourly_rate, ended_at, final_elapsed_seconds, final_cost, stations(type)")
        .eq("business_id", businessId)
        .eq("status", "completed")
        .order("ended_at", { ascending: true })
        .range(page * pageSize, ((page + 1) * pageSize) - 1);
      if (from) query = query.gte("ended_at", from);
      if (to) query = query.lt("ended_at", to);

      const { data, error } = await query;
      throwDatabaseError(error);
      rows.push(...data);
      if (data.length < pageSize) break;
      page += 1;
    }

    return rows;
  },

  async getOperationalCounts(businessId) {
    const [stationsResult, sessionsResult] = await Promise.all([
      getSupabaseDataClient()
        .from("stations")
        .select("status", { count: "exact" })
        .eq("business_id", businessId)
        .is("archived_at", null),
      getSupabaseDataClient()
        .from("sessions")
        .select("status", { count: "exact" })
        .eq("business_id", businessId)
        .in("status", ["active", "paused"]),
    ]);
    throwDatabaseError(stationsResult.error);
    throwDatabaseError(sessionsResult.error);

    const statusCounts = { available: 0, active: 0, paused: 0 };
    for (const station of stationsResult.data) statusCounts[station.status] += 1;
    return {
      stationCount: stationsResult.count ?? stationsResult.data.length,
      activeSessionCount: sessionsResult.count ?? sessionsResult.data.length,
      stationStatusCounts: statusCounts,
    };
  },
};
