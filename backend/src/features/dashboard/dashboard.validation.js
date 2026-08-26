import { CHART_GRANULARITIES, DASHBOARD_PERIODS } from "../../shared/constants/session.js";

function parseOptionalDate(value, field) {
  if (!value) return { value: undefined };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dateOnly = new Date(`${value}T00:00:00.000Z`);
    return dateOnly.toISOString().slice(0, 10) === value ? { value } : { error: `${field} must be a valid ISO date` };
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? { error: `${field} must be a valid ISO date` }
    : { value: date.toISOString() };
}

export function validateDashboardPeriod(request) {
  return DASHBOARD_PERIODS.includes(request.params.period)
    ? { success: true, data: { period: request.params.period } }
    : { success: false, errors: [`period must be one of: ${DASHBOARD_PERIODS.join(", ")}`] };
}

export function validateChartRequest(request) {
  const granularity = request.params.granularity;
  const from = parseOptionalDate(request.query.from, "from");
  const to = parseOptionalDate(request.query.to, "to");
  const errors = [];
  if (!CHART_GRANULARITIES.includes(granularity)) {
    errors.push(`granularity must be one of: ${CHART_GRANULARITIES.join(", ")}`);
  }
  if (from.error) errors.push(from.error);
  if (to.error) errors.push(to.error);
  if (from.value && to.value && from.value >= to.value) errors.push("from must be before to");
  return errors.length
    ? { success: false, errors }
    : { success: true, data: { granularity, from: from.value, to: to.value } };
}
