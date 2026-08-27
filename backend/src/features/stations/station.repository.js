import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
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
  async findById(businessId, stationId) {
    const { data, error } = await getSupabaseAdmin()
      .from("stations")
      .select(stationFields)
      .eq("business_id", businessId)
      .eq("id", stationId)
      .maybeSingle();
    throwDatabaseError(error);
    return mapStation(data);
  },

  async updateStatus(businessId, stationId, status) {
    const { data, error } = await getSupabaseAdmin()
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
    const { data, error } = await getSupabaseAdmin()
      .from("stations")
      .select(stationFields)
      .eq("business_id", businessId)
      .order("type")
      .order("number");
    throwDatabaseError(error);
    return data.map(mapStation);
  },

  async listIds(businessId) {
    const { data, error } = await getSupabaseAdmin()
      .from("stations")
      .select("id")
      .eq("business_id", businessId);
    throwDatabaseError(error);
    return data.map((station) => station.id);
  },

  async findOwnedIds(stationIds) {
    if (stationIds.length === 0) return [];
    const { data, error } = await getSupabaseAdmin()
      .from("stations")
      .select("id, business_id")
      .in("id", stationIds);
    throwDatabaseError(error);
    return data;
  },

  async upsert(businessId, stations) {
    if (stations.length === 0) return [];
    const rows = stations.map((station) => ({
      id: station.id,
      business_id: businessId,
      type: station.type,
      number: station.number,
      hourly_rate: station.hourlyRate,
      status: station.status,
      session_start_at: station.sessionStartAt,
      paused_at: station.pausedAt,
      total_paused_ms: station.totalPausedMs,
      planned_start_at: station.plannedStartAt,
    }));
    const { data, error } = await getSupabaseAdmin()
      .from("stations")
      .upsert(rows, { onConflict: "id" })
      .select(stationFields);
    throwDatabaseError(error);
    return data.map(mapStation);
  },

  async removeByIds(businessId, stationIds) {
    if (stationIds.length === 0) return;
    const { error } = await getSupabaseAdmin()
      .from("stations")
      .delete()
      .eq("business_id", businessId)
      .in("id", stationIds);
    throwDatabaseError(error);
  },
};
