import { apiFileRequest, apiRequest } from "./api";
import { createInFlightRequestCache } from "./inFlightRequests";

const reportRequests = createInFlightRequestCache();

function query(parameters) {
  return new URLSearchParams(parameters).toString();
}

export async function getDailySummary(date, signal) {
  const payload = await apiRequest(`/business/daily?${query({ date })}`, { signal });
  return payload.data.summary;
}

export async function getMonthlySummary(year, month, signal) {
  const payload = await apiRequest(`/business/monthly?${query({ year, month })}`, { signal });
  return payload.data.summary;
}

export async function getYearlySummary(year, signal) {
  const payload = await apiRequest(`/business/yearly?${query({ year })}`, { signal });
  return payload.data.summary;
}

function safeDownloadName(contentDisposition, config) {
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  const received = match?.[1]?.replace(/[^a-zA-Z0-9._-]/g, "");
  if (received?.toLowerCase().endsWith(".pdf")) return received;
  const period = config.reportType === "daily" ? config.date
    : config.reportType === "monthly" ? `${config.year}-${String(config.month).padStart(2, "0")}`
      : config.year;
  return `business-report-${config.reportType}-${period}.pdf`;
}

export function downloadBusinessReport(config) {
  const key = JSON.stringify(config);
  return reportRequests.run(key, async () => {
    const { blob, contentDisposition } = await apiFileRequest("/business/reports/pdf", {
      method: "POST",
      body: JSON.stringify(config),
    });
    if (blob.type && !blob.type.toLowerCase().startsWith("application/pdf")) {
      throw new Error("The downloaded report is not a PDF");
    }
    const filename = safeDownloadName(contentDisposition, config);
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    return filename;
  });
}
