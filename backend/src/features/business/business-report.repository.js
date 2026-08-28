import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { AppError } from "../../shared/errors/AppError.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

const BUCKET = "business-reports";

function mapExport(row) {
  if (!row) return null;
  return {
    id: row.id,
    reportType: row.report_type,
    periodKey: row.period_key,
    filename: row.filename,
    title: row.config?.title ?? "",
    language: row.config?.language ?? "en",
    sizeBytes: Number(row.size_bytes) || 0,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    storagePath: row.storage_path,
  };
}

function storageError(error, message, code) {
  if (!error) return;
  const wrapped = new AppError(503, message, code);
  wrapped.cause = error;
  throw wrapped;
}

export const businessReportExportRepository = {
  async reserve({ businessId, requestedBy, quotaMonth, reportType, periodKey, filename, config }) {
    const { data, error } = await getSupabaseAdmin().rpc("reserve_business_report_export", {
      p_business_id: businessId,
      p_requested_by: requestedBy,
      p_quota_month: quotaMonth,
      p_report_type: reportType,
      p_period_key: periodKey,
      p_filename: filename,
      p_config: config,
    });
    throwDatabaseError(error);
    const result = data?.[0];
    if (!result) throw new AppError(503, "Unable to reserve a PDF export", "REPORT_RESERVATION_FAILED");
    return {
      outcome: result.outcome,
      exportId: result.export_id,
      used: Number(result.used_count) || 0,
      remaining: Number(result.remaining_count) || 0,
    };
  },

  async upload(storagePath, buffer) {
    const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: false,
    });
    storageError(error, "Unable to save the PDF report", "REPORT_STORAGE_FAILED");
  },

  async complete({ businessId, exportId, storagePath, sizeBytes }) {
    const { data, error } = await getSupabaseAdmin()
      .from("business_report_exports")
      .update({ status: "completed", storage_path: storagePath, size_bytes: sizeBytes, completed_at: new Date().toISOString() })
      .eq("id", exportId)
      .eq("business_id", businessId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    throwDatabaseError(error);
    if (!data) throw new AppError(409, "The PDF export reservation expired", "REPORT_RESERVATION_EXPIRED");
  },

  async fail({ businessId, exportId, failureCode }) {
    const { error } = await getSupabaseAdmin()
      .from("business_report_exports")
      .update({ status: "failed", failure_code: failureCode })
      .eq("id", exportId)
      .eq("business_id", businessId)
      .eq("status", "pending");
    throwDatabaseError(error);
  },

  async remove(storagePath) {
    if (!storagePath) return;
    await getSupabaseAdmin().storage.from(BUCKET).remove([storagePath]);
  },

  async getStatus({ businessId, quotaMonth }) {
    const client = getSupabaseAdmin();
    const [countResult, reportsResult] = await Promise.all([
      client.from("business_report_exports").select("id", { count: "exact", head: true })
        .eq("business_id", businessId).eq("quota_month", quotaMonth).eq("status", "completed"),
      client.from("business_report_exports")
        .select("id, report_type, period_key, filename, config, size_bytes, created_at, completed_at, storage_path")
        .eq("business_id", businessId).eq("status", "completed")
        .order("completed_at", { ascending: false }),
    ]);
    throwDatabaseError(countResult.error);
    throwDatabaseError(reportsResult.error);
    const used = countResult.count ?? 0;
    return { used, reports: (reportsResult.data ?? []).map(mapExport) };
  },

  async findCompleted(businessId, exportId) {
    const { data, error } = await getSupabaseAdmin()
      .from("business_report_exports")
      .select("id, report_type, period_key, filename, config, size_bytes, created_at, completed_at, storage_path")
      .eq("id", exportId).eq("business_id", businessId).eq("status", "completed")
      .maybeSingle();
    throwDatabaseError(error);
    return mapExport(data);
  },

  async download(storagePath) {
    const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(storagePath);
    storageError(error, "Unable to download the saved PDF report", "REPORT_DOWNLOAD_FAILED");
    return Buffer.from(await data.arrayBuffer());
  },
};
