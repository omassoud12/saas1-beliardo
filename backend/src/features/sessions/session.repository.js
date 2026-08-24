import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { OPEN_SESSION_STATUSES } from "../../shared/constants/session.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

export function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    stationId: row.station_id,
    status: row.status,
    hourlyRate: Number(row.hourly_rate),
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    endedAt: row.ended_at,
    totalPausedSeconds: Number(row.total_paused_seconds) || 0,
    finalElapsedSeconds: row.final_elapsed_seconds === null ? null : Number(row.final_elapsed_seconds),
    finalCost: row.final_cost === null ? null : Number(row.final_cost),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.station ? { station: row.station } : {}),
  };
}

const selectFields = `
  id, business_id, station_id, status, hourly_rate, started_at, paused_at,
  ended_at, total_paused_seconds, final_elapsed_seconds, final_cost,
  created_by, created_at, updated_at,
  station:stations(id, type, number, hourly_rate, status)
`;

export const sessionRepository = {
  async create(values) {
    const { data, error } = await getSupabaseAdmin()
      .from("sessions")
      .insert({
        business_id: values.businessId,
        station_id: values.stationId,
        status: "draft",
        hourly_rate: values.hourlyRate,
        created_by: values.createdBy,
      })
      .select(selectFields)
      .single();
    throwDatabaseError(error);
    return mapSession(data);
  },

  async findById(businessId, sessionId) {
    const { data, error } = await getSupabaseAdmin()
      .from("sessions")
      .select(selectFields)
      .eq("business_id", businessId)
      .eq("id", sessionId)
      .maybeSingle();
    throwDatabaseError(error);
    return mapSession(data);
  },

  async findOpenByStation(businessId, stationId) {
    const { data, error } = await getSupabaseAdmin()
      .from("sessions")
      .select(selectFields)
      .eq("business_id", businessId)
      .eq("station_id", stationId)
      .in("status", OPEN_SESSION_STATUSES)
      .maybeSingle();
    throwDatabaseError(error);
    return mapSession(data);
  },

  async findActive(businessId) {
    const { data, error } = await getSupabaseAdmin()
      .from("sessions")
      .select(selectFields)
      .eq("business_id", businessId)
      .in("status", ["active", "paused"])
      .order("started_at", { ascending: true });
    throwDatabaseError(error);
    return data.map(mapSession);
  },

  async findCompleted(businessId, { from, to, limit = 50 }) {
    let query = getSupabaseAdmin()
      .from("sessions")
      .select(selectFields)
      .eq("business_id", businessId)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(limit);

    if (from) query = query.gte("ended_at", from);
    if (to) query = query.lt("ended_at", to);

    const { data, error } = await query;
    throwDatabaseError(error);
    return data.map(mapSession);
  },

  async update(businessId, sessionId, values) {
    const { data, error } = await getSupabaseAdmin()
      .from("sessions")
      .update(values)
      .eq("business_id", businessId)
      .eq("id", sessionId)
      .select(selectFields)
      .single();
    throwDatabaseError(error);
    return mapSession(data);
  },

  async remove(businessId, sessionId) {
    const { error } = await getSupabaseAdmin()
      .from("sessions")
      .delete()
      .eq("business_id", businessId)
      .eq("id", sessionId);
    throwDatabaseError(error);
  },
};
