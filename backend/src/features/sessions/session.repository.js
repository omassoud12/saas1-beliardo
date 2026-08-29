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
    controllerCount: Number(row.controller_count) || 1,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    endedAt: row.ended_at,
    cancelledAt: row.cancelled_at ?? null,
    cancelledBy: row.cancelled_by ?? null,
    endedRecordedAt: row.ended_recorded_at ?? null,
    endedBy: row.ended_by ?? null,
    pauseIntervals: Array.isArray(row.pause_intervals) ? row.pause_intervals : [],
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
  id, business_id, station_id, status, hourly_rate, controller_count, started_at, paused_at,
  ended_at, ended_recorded_at, ended_by, cancelled_at, cancelled_by, pause_intervals,
  total_paused_seconds, final_elapsed_seconds, final_cost,
  created_by, created_at, updated_at,
  station:stations(id, type, number, hourly_rate, status)
`;

export const sessionRepository = {
  async startNew(values) {
    const { data, error } = await getSupabaseAdmin().rpc("start_session_atomic", {
      p_business_id: values.businessId,
      p_started_by: values.startedBy,
      p_station_id: values.stationId,
      p_hourly_rate: values.hourlyRate,
      p_controller_count: values.controllerCount ?? null,
      p_started_at: values.startedAt,
    });
    throwDatabaseError(error);
    const result = data?.[0] ?? { outcome: "station_not_found", session_record: null };
    return {
      outcome: result.outcome,
      session: mapSession(result.session_record),
    };
  },

  async create(values) {
    const { data, error } = await getSupabaseAdmin()
      .from("sessions")
      .insert({
        business_id: values.businessId,
        station_id: values.stationId,
        status: "draft",
        hourly_rate: values.hourlyRate,
        controller_count: values.controllerCount,
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

  async countCompleted(businessId, { from, to }) {
    let query = getSupabaseAdmin()
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "completed");
    if (from) query = query.gte("ended_at", from);
    if (to) query = query.lt("ended_at", to);
    const { count, error } = await query;
    throwDatabaseError(error);
    return count ?? 0;
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

  async cancel(businessId, sessionId, cancelledBy) {
    const { data, error } = await getSupabaseAdmin().rpc("cancel_session", {
      p_business_id: businessId,
      p_session_id: sessionId,
      p_cancelled_by: cancelledBy,
    });
    throwDatabaseError(error);
    const result = data?.[0] ?? { outcome: "not_found", session_record: null };
    return {
      outcome: result.outcome,
      session: mapSession(result.session_record),
    };
  },

  async complete(values) {
    const { data, error } = await getSupabaseAdmin().rpc("end_session", {
      p_business_id: values.businessId,
      p_session_id: values.sessionId,
      p_ended_by: values.endedBy,
      p_ended_at: values.endedAt,
      p_expected_updated_at: values.expectedUpdatedAt,
      p_total_paused_seconds: values.totalPausedSeconds,
      p_final_elapsed_seconds: values.finalElapsedSeconds,
      p_final_cost: values.finalCost,
      p_pause_intervals: values.pauseIntervals,
    });
    throwDatabaseError(error);
    const result = data?.[0] ?? { outcome: "not_found", session_record: null };
    return {
      outcome: result.outcome,
      session: mapSession(result.session_record),
    };
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
