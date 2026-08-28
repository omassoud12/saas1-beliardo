import { AppError } from "../../shared/errors/AppError.js";
import { businessRepository } from "./business.repository.js";
import { businessService } from "./business.service.js";
import { createReportDocument } from "./business-report.template.js";
import { renderPdf } from "./business-report.pdf.js";
import { businessReportExportRepository } from "./business-report.repository.js";
import { reportGenerationGate } from "./business-report.concurrency.js";

const MONTHLY_EXPORT_LIMIT = 6;

function periodKey(config) {
  return config.reportType === "daily" ? config.date
    : config.reportType === "monthly" ? `${config.year}-${String(config.month).padStart(2, "0")}`
      : String(config.year);
}

function safeFilename(config) {
  return `business-report-${config.reportType}-${periodKey(config)}.pdf`;
}

export function quotaMonthAt(date, timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-01`;
}

function reservationError(reservation) {
  if (reservation.outcome === "quota_exceeded") {
    return new AppError(429, "The monthly PDF export limit has been reached", "REPORT_QUOTA_EXCEEDED", {
      limit: MONTHLY_EXPORT_LIMIT, used: reservation.used, remaining: 0,
    });
  }
  if (reservation.outcome === "generation_in_progress") {
    return new AppError(409, "A PDF report is already being generated for this business", "REPORT_GENERATION_IN_PROGRESS");
  }
  if (reservation.outcome === "forbidden") {
    return new AppError(403, "Only an approved owner can export business reports", "REPORT_EXPORT_FORBIDDEN");
  }
  return new AppError(503, "Unable to reserve a PDF export", "REPORT_RESERVATION_FAILED");
}

export function createBusinessReportService({
  summaries = businessService,
  repository = businessRepository,
  exports = businessReportExportRepository,
  pdf = renderPdf,
  gate = reportGenerationGate,
  clock = () => new Date(),
} = {}) {
  return {
    async generate({ businessId, userId, timezone, config, signal }) {
      return gate.run(async () => {
        const generatedAt = clock();
        const quotaMonth = quotaMonthAt(generatedAt, timezone);
        const filename = safeFilename(config);
        const reservation = await exports.reserve({
          businessId,
          requestedBy: userId,
          quotaMonth,
          reportType: config.reportType,
          periodKey: periodKey(config),
          filename,
          config,
        });
        if (reservation.outcome !== "reserved") throw reservationError(reservation);

        const storagePath = `${businessId}/${quotaMonth.slice(0, 7)}/${reservation.exportId}.pdf`;
        let uploaded = false;
        try {
          const method = config.reportType === "daily" ? "daily" : config.reportType === "monthly" ? "monthly" : "yearly";
          const [business, summary] = await Promise.all([
            repository.findBusiness(businessId),
            summaries[method]({ businessId, timezone, date: config.date, year: config.year, month: config.month }),
          ]);
          if (!business) throw new AppError(404, "Business not found", "BUSINESS_NOT_FOUND");
          const document = createReportDocument({ ...config, business, summary, timezone, generatedAt });
          const buffer = Buffer.from(await pdf(document, signal));
          await exports.upload(storagePath, buffer);
          uploaded = true;
          await exports.complete({ businessId, exportId: reservation.exportId, storagePath, sizeBytes: buffer.length });
          return {
            buffer,
            filename,
            reportId: reservation.exportId,
            quota: { limit: MONTHLY_EXPORT_LIMIT, used: reservation.used + 1, remaining: reservation.remaining },
          };
        } catch (error) {
          if (uploaded) await exports.remove(storagePath).catch(() => {});
          await exports.fail({
            businessId,
            exportId: reservation.exportId,
            failureCode: error.code ?? "REPORT_GENERATION_FAILED",
          }).catch(() => {});
          throw error;
        }
      });
    },

    async list({ businessId, timezone }) {
      const month = quotaMonthAt(clock(), timezone);
      const result = await exports.getStatus({ businessId, quotaMonth: month });
      return {
        quota: { limit: MONTHLY_EXPORT_LIMIT, used: result.used, remaining: Math.max(0, MONTHLY_EXPORT_LIMIT - result.used), month },
        reports: result.reports.map(({ storagePath: _storagePath, ...report }) => report),
      };
    },

    async download({ businessId, reportId }) {
      const report = await exports.findCompleted(businessId, reportId);
      if (!report) throw new AppError(404, "Saved PDF report not found", "REPORT_NOT_FOUND");
      return { buffer: await exports.download(report.storagePath), filename: report.filename };
    },
  };
}

export const businessReportService = createBusinessReportService();
