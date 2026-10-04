import { createHash } from "node:crypto";
import { AppError } from "../../shared/errors/AppError.js";
import { businessHistoricalRepository } from "./business-historical.repository.js";

function contentHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function displayMonth(start, end) {
  const first = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const left = formatter.format(first);
  return start.slice(0, 7) === end.slice(0, 7) ? left : `${left} – ${formatter.format(last)}`;
}

function summary(payload) {
  const totalsByCurrency = {};
  let revenueUsd = 0;
  let expensesUsd = 0;
  let knownExpenseDays = 0;
  for (const record of payload.records) {
    totalsByCurrency[record.revenue.currency] = (totalsByCurrency[record.revenue.currency] ?? 0) + Number(record.revenue.total);
    revenueUsd += Number(record.revenue.usd);
    if (record.expenses) {
      expensesUsd += Number(record.expenses.usd);
      knownExpenseDays += 1;
    }
  }
  return {
    label: displayMonth(payload.coverage.start_business_date, payload.coverage.end_business_date),
    startBusinessDate: payload.coverage.start_business_date,
    endBusinessDate: payload.coverage.end_business_date,
    coverageMode: payload.coverage.mode,
    recordCount: payload.records.length,
    totalsByCurrency: Object.fromEntries(Object.entries(totalsByCurrency).map(([currency, amount]) => [currency, Math.round(amount * 100) / 100])),
    revenueUsd: Math.round(revenueUsd * 100) / 100,
    expensesUsd: Math.round(expensesUsd * 100) / 100,
    knownExpenseDays,
    source: payload.source ?? null,
  };
}

function previewRecords(payload, conflicts) {
  const conflictSet = new Set(conflicts);
  return payload.records.map((record) => {
    const warnings = [];
    if (!record.expenses) warnings.push("Expenses unknown");
    if (record.operations?.completed_sessions === undefined) warnings.push("Session count unknown");
    if (record.operations?.total_duration_seconds === undefined) warnings.push("Duration unknown");
    if (!record.revenue.by_activity) warnings.push("Activity breakdown unknown");
    const conflict = conflictSet.has(record.business_date);
    return {
      businessDate: record.business_date,
      revenue: { amount: Number(record.revenue.total), currency: record.revenue.currency, usd: Number(record.revenue.usd) },
      expenses: record.expenses ? { amount: Number(record.expenses.total), currency: record.expenses.currency, usd: Number(record.expenses.usd) } : null,
      completedSessions: record.operations?.completed_sessions ?? null,
      totalDurationSeconds: record.operations?.total_duration_seconds ?? null,
      activities: record.revenue.by_activity?.map((item) => item.activity_type) ?? [],
      notes: record.notes ?? "",
      warnings,
      status: conflict ? "conflict" : warnings.length ? "warning" : "ready",
    };
  });
}

export function createBusinessHistoricalService({ repository = businessHistoricalRepository } = {}) {
  return {
    async preview({ businessId, userId, payload }) {
      const hash = contentHash(payload);
      const inspection = await repository.inspect(businessId, userId, payload.records.map((record) => record.business_date), hash);
      const records = previewRecords(payload, inspection.conflictDates);
      const warningCount = records.filter((record) => record.status === "warning").length
        + (payload.coverage.mode === "partial" ? 1 : 0);
      return {
        summary: summary(payload),
        records,
        warningCount,
        conflictCount: inspection.conflictDates.length,
        duplicateFile: inspection.duplicateFile,
        canConfirm: !inspection.duplicateFile && inspection.conflictDates.length === 0,
      };
    },

    async confirm({ businessId, userId, payload }) {
      const hash = contentHash(payload);
      const result = await repository.save(businessId, userId, hash, payload);
      if (result.outcome === "already_imported") throw new AppError(409, "This historical data has already been imported", "HISTORICAL_ALREADY_IMPORTED");
      if (result.outcome === "conflict") throw new AppError(409, "One or more business dates already contain data", "HISTORICAL_DATE_CONFLICT");
      if (result.outcome === "forbidden") throw new AppError(403, "Only an approved owner can import historical data", "FORBIDDEN");
      if (result.outcome !== "saved") throw new AppError(503, "Historical data could not be saved", "HISTORICAL_IMPORT_FAILED");
      return {
        id: result.record.id,
        recordCount: result.record.record_count,
        coverageStart: result.record.coverage_start,
        coverageEnd: result.record.coverage_end,
        status: result.record.status,
        confirmedAt: result.record.confirmed_at,
      };
    },

    list(businessId, pagination) { return repository.list(businessId, pagination); },
  };
}

export const businessHistoricalService = createBusinessHistoricalService();
