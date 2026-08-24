import { apiRequest } from "./api";

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
