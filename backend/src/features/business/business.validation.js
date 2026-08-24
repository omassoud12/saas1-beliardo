const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function validYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

export function validateDailySummary(request) {
  const date = request.query.date;
  const match = typeof date === "string" ? date.match(datePattern) : null;
  if (!match) return { success: false, errors: ["date must use YYYY-MM-DD"] };
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return { success: false, errors: ["date must be a valid calendar date"] };
  }
  return { success: true, data: { date } };
}

export function validateMonthlySummary(request) {
  const year = validYear(request.query.year);
  const month = Number(request.query.month);
  const errors = [];
  if (!year) errors.push("year must be between 2000 and 2100");
  if (!Number.isInteger(month) || month < 1 || month > 12) errors.push("month must be between 1 and 12");
  return errors.length ? { success: false, errors } : { success: true, data: { year, month } };
}

export function validateYearlySummary(request) {
  const year = validYear(request.query.year);
  return year
    ? { success: true, data: { year } }
    : { success: false, errors: ["year must be between 2000 and 2100"] };
}
