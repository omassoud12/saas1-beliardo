import { AppError } from "../../shared/errors/AppError.js";
import { businessRepository } from "./business.repository.js";
import { businessService } from "./business.service.js";
import { createReportDocument } from "./business-report.template.js";
import { renderPdf } from "./business-report.pdf.js";

function safeFilename(config) {
  const period = config.reportType === "daily" ? config.date
    : config.reportType === "monthly" ? `${config.year}-${String(config.month).padStart(2, "0")}`
      : String(config.year);
  return `business-report-${config.reportType}-${period}.pdf`;
}

export function createBusinessReportService({
  summaries = businessService,
  repository = businessRepository,
  pdf = renderPdf,
  clock = () => new Date(),
} = {}) {
  return {
    async generate({ businessId, timezone, config, signal }) {
      const method = config.reportType === "daily" ? "daily" : config.reportType === "monthly" ? "monthly" : "yearly";
      const [business, summary] = await Promise.all([
        repository.findBusiness(businessId),
        summaries[method]({ businessId, timezone, date: config.date, year: config.year, month: config.month }),
      ]);
      if (!business) throw new AppError(404, "Business not found", "BUSINESS_NOT_FOUND");
      const document = createReportDocument({
        ...config,
        business,
        summary,
        timezone,
        generatedAt: clock(),
      });
      const bytes = await pdf(document, signal);
      return { buffer: Buffer.from(bytes), filename: safeFilename(config) };
    },
  };
}

export const businessReportService = createBusinessReportService();
