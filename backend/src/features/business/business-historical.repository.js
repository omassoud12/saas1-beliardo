import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { getSupabaseDataClient } from "../../middleware/requestContext.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

function mapImport(row) {
  return {
    id: row.id,
    schemaVersion: row.schema_version,
    periodType: row.period_type,
    sourceType: row.source_type,
    sourceReference: row.source_reference,
    coverageStart: row.coverage_start,
    coverageEnd: row.coverage_end,
    coverageMode: row.coverage_mode,
    recordCount: row.record_count,
    status: row.status,
    confirmedAt: row.confirmed_at,
  };
}

export const businessHistoricalRepository = {
  async inspect(businessId, userId, dates, contentHash) {
    const { data, error } = await getSupabaseAdmin().rpc("inspect_business_historical_import", {
      p_business_id: businessId,
      p_actor_user_id: userId,
      p_business_dates: dates,
      p_content_hash: contentHash,
    });
    throwDatabaseError(error);
    const result = data?.[0] ?? {};
    return {
      duplicateFile: Boolean(result.duplicate_file),
      conflictDates: result.conflict_dates ?? [],
    };
  },

  async save(businessId, userId, contentHash, payload) {
    const { data, error } = await getSupabaseAdmin().rpc("save_business_historical_import_atomic", {
      p_business_id: businessId,
      p_actor_user_id: userId,
      p_content_hash: contentHash,
      p_payload: payload,
    });
    throwDatabaseError(error);
    const result = data?.[0] ?? {};
    return { outcome: result.outcome ?? "failed", record: result.record_data ?? null };
  },

  async list(businessId, { page = 1, pageSize = 20 } = {}) {
    const offset = (page - 1) * pageSize;
    const { data, error, count } = await getSupabaseDataClient()
      .from("business_historical_imports")
      .select("id, schema_version, period_type, source_type, source_reference, coverage_start, coverage_end, coverage_mode, record_count, status, confirmed_at", { count: "exact" })
      .eq("business_id", businessId)
      .order("confirmed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    throwDatabaseError(error);
    const items = (data ?? []).map(mapImport);
    const total = count ?? 0;
    return { items, total, page, pageSize, hasMore: offset + items.length < total };
  },

  async listDailyForRange(businessId, startDate, endDateExclusive) {
    const { data, error } = await getSupabaseDataClient()
      .from("business_historical_daily")
      .select("business_date, revenue_usd, expenses_usd, completed_sessions, total_duration_seconds, import:business_historical_imports!inner(coverage_mode, coverage_start, coverage_end)")
      .eq("business_id", businessId)
      .eq("status", "active")
      .gte("business_date", startDate)
      .lt("business_date", endDateExclusive)
      .order("business_date", { ascending: true });
    throwDatabaseError(error);
    return (data ?? []).map((row) => ({
      businessDate: row.business_date,
      revenueUsd: Number(row.revenue_usd),
      expensesUsd: row.expenses_usd === null ? null : Number(row.expenses_usd),
      completedSessions: row.completed_sessions === null ? null : Number(row.completed_sessions),
      totalDurationSeconds: row.total_duration_seconds === null ? null : Number(row.total_duration_seconds),
      coverageMode: (Array.isArray(row.import) ? row.import[0] : row.import)?.coverage_mode ?? "partial",
    }));
  },
};
