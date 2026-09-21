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

export async function getBusinessAnalysis(period, parameters, signal) {
  const payload = await apiRequest(`/business/analysis?${query({ period, ...parameters })}`, { signal });
  return payload.data.analysis;
}

export async function getBusinessOverview(period, parameters, signal) {
  const payload = await apiRequest(`/business/overview?${query({ period, ...parameters })}`, { signal });
  return payload.data.overview;
}

export async function getBusinessExpenses(page = 1, pageSize = 20, signal) {
  const payload = await apiRequest(`/business/expenses?${query({ page, pageSize })}`, { signal });
  return { items: payload.data.expenses, pagination: payload.data.pagination };
}

export async function getBusinessExpenseHistory(page = 1, pageSize = 20, signal) {
  const payload = await apiRequest(`/business/expenses/history?${query({ page, pageSize })}`, { signal });
  return { items: payload.data.expenses, pagination: payload.data.pagination };
}

export async function getStationPerformance(period, parameters, signal) {
  const payload = await apiRequest(`/business/station-performance?${query({ period, ...parameters })}`, { signal });
  return payload.data.stationPerformance;
}

export async function saveBusinessExpense(values, expenseId) {
  const payload = await apiRequest(expenseId ? `/business/expenses/${expenseId}` : "/business/expenses", {
    method: expenseId ? "PATCH" : "POST",
    body: JSON.stringify(values),
  });
  return payload.data.expense;
}

export async function deleteBusinessExpense(expenseId) {
  await apiRequest(`/business/expenses/${expenseId}`, { method: "DELETE" });
}

export async function getBusinessTargets(page = 1, pageSize = 20, signal) {
  const payload = await apiRequest(`/business/targets?${query({ page, pageSize })}`, { signal });
  return { items: payload.data.targets, pagination: payload.data.pagination };
}

export async function saveBusinessTarget(values, targetId) {
  const payload = await apiRequest(targetId ? `/business/targets/${targetId}` : "/business/targets", {
    method: targetId ? "PATCH" : "POST",
    body: JSON.stringify(values),
  });
  return payload.data.target;
}

export async function deleteBusinessTarget(targetId) {
  await apiRequest(`/business/targets/${targetId}`, { method: "DELETE" });
}

function safeDownloadName(contentDisposition, fallbackFilename) {
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
  const received = match?.[1]?.replace(/[^a-zA-Z0-9._-]/g, "");
  if (received?.toLowerCase().endsWith(".pdf")) return received;
  return fallbackFilename;
}

function triggerDownload(blob, contentDisposition, fallbackFilename) {
  const filename = safeDownloadName(contentDisposition, fallbackFilename);
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
    const period = config.reportType === "daily" ? config.date
      : config.reportType === "monthly" ? `${config.year}-${String(config.month).padStart(2, "0")}`
        : config.year;
    return triggerDownload(blob, contentDisposition, `business-report-${config.reportType}-${period}.pdf`);
  });
}

export async function getBusinessReportExports(page = 1, pageSize = 10, signal) {
  const payload = await apiRequest(`/business/reports?${query({ page, pageSize })}`, { signal });
  return payload.data;
}

export async function downloadSavedBusinessReport(report) {
  const { blob, contentDisposition } = await apiFileRequest(`/business/reports/${report.id}/pdf`);
  return triggerDownload(blob, contentDisposition, report.filename);
}
