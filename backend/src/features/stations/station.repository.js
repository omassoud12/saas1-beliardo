import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { getSupabaseDataClient } from "../../middleware/requestContext.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

const stationFields = `
  id, business_id, type, number, hourly_rate, status,
  session_start_at, paused_at, total_paused_ms, planned_start_at
`;

export function mapStation(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    type: row.type,
    number: row.number,
    hourlyRate: Number(row.hourly_rate),
    status: row.status,
    sessionStartAt: row.session_start_at,
    pausedAt: row.paused_at,
    totalPausedMs: Number(row.total_paused_ms) || 0,
    plannedStartAt: row.planned_start_at,
  };
}

export const stationRepository = {
  async sync(businessId, actorUserId, stations) {
    const { data, error } = await getSupabaseAdmin().rpc("sync_stations_atomic", {
      p_business_id: businessId,
      p_actor_user_id: actorUserId,
      p_stations: stations,
    });
    throwDatabaseError(error);
    const result = data?.[0] ?? { outcome: "conflict", station_records: null };
    return {
      outcome: result.outcome,
      stations: Array.isArray(result.station_records) ? result.station_records.map(mapStation) : [],
    };
  },

  async findById(businessId, stationId) {
    const { data, error } = await getSupabaseDataClient()
      .from("stations")
      .select(stationFields)
      .eq("business_id", businessId)
      .eq("id", stationId)
      .is("archived_at", null)
      .maybeSingle();
    throwDatabaseError(error);
    return mapStation(data);
  },

  async updateStatus(businessId, stationId, status) {
    const { data, error } = await getSupabaseDataClient()
      .from("stations")
      .update({ status })
      .eq("business_id", businessId)
      .eq("id", stationId)
      .select(stationFields)
      .single();
    throwDatabaseError(error);
    return mapStation(data);
  },

  async list(businessId) {
    const { data, error } = await getSupabaseDataClient()
      .from("stations")
      .select(stationFields)
      .eq("business_id", businessId)
      .is("archived_at", null)
      .order("type")
      .order("number");
    throwDatabaseError(error);
    return data.map(mapStation);
  },

};
