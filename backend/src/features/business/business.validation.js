const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value) {
  const match = typeof value === "string" ? value.match(datePattern) : null;
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function validYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

export function validateDailySummary(request) {
  const date = request.query.date;
  if (!validDate(date)) {
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

export function validateBusinessAnalysis(request) {
  const period = request.query.period;
  if (!["daily", "monthly", "yearly"].includes(period)) {
    return { success: false, errors: ["period must be daily, monthly, or yearly"] };
  }
  const result = period === "daily" ? validateDailySummary(request)
    : period === "monthly" ? validateMonthlySummary(request) : validateYearlySummary(request);
  return result.success ? { success: true, data: { period, ...result.data } } : result;
}

function boundedNumber(value, { minimum = 0, maximum = 1_000_000_000_000_000, required = true } = {}) {
  if ((value === null || value === undefined || value === "") && !required) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : undefined;
}

function identifier(request, parameter) {
  const value = request.params?.[parameter];
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

export function validateExpenseId(request) {
  const expenseId = identifier(request, "expenseId");
  return expenseId ? { success: true, data: { expenseId } } : { success: false, errors: ["expenseId must be a valid UUID"] };
}

export function validateExpense(request) {
  const body = request.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.toUpperCase() : "";
  const recurrence = typeof body.recurrence === "string" ? body.recurrence.toLowerCase() : "";
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "";
  const amount = boundedNumber(body.amount, { minimum: 0.01 });
  const exchangeRateToUsd = currency === "USD" ? 1 : boundedNumber(body.exchangeRateToUsd, { minimum: 0.000001 });
  const occurrenceDate = recurrence === "one_time" ? body.occurrenceDate : null;
  const startDate = recurrence === "one_time" ? occurrenceDate : body.startDate;
  const endDate = body.endDate || null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const errors = [];
  if (!name || name.length > 100) errors.push("name must contain 1 to 100 characters");
  if (!["RENT", "ELECTRICITY", "EMPLOYEES", "OTHER"].includes(category)) errors.push("category is invalid");
  if (!["one_time", "weekly", "monthly", "yearly"].includes(recurrence)) errors.push("recurrence is invalid");
  if (!["USD", "LBP"].includes(currency)) errors.push("currency must be USD or LBP");
  if (amount === undefined) errors.push("amount must be a positive number");
  if (exchangeRateToUsd === undefined) errors.push("exchangeRateToUsd must be a positive LBP-per-USD rate");
  if (!validDate(startDate)) errors.push(recurrence === "one_time" ? "occurrenceDate must be valid" : "startDate must be valid");
  if (endDate && !validDate(endDate)) errors.push("endDate must be valid");
  if (endDate && startDate && endDate < startDate) errors.push("endDate cannot be before the start date");
  if (notes.length > 500) errors.push("notes cannot exceed 500 characters");
  if (typeof body.includeInProfit !== "undefined" && typeof body.includeInProfit !== "boolean") errors.push("includeInProfit must be boolean");
  return errors.length ? { success: false, errors } : { success: true, data: {
    name, category, amount, currency, exchangeRateToUsd, recurrence,
    occurrenceDate, startDate, endDate, notes, includeInProfit: body.includeInProfit !== false,
  } };
}

export function validateExpenseUpdate(request) {
  const id = validateExpenseId(request);
  const values = validateExpense(request);
  return !id.success || !values.success
    ? { success: false, errors: [...(id.errors ?? []), ...(values.errors ?? [])] }
    : { success: true, data: { expenseId: id.data.expenseId, values: values.data } };
}

export function validateTarget(request) {
  const body = request.body ?? {};
  const monthlyTotalTarget = boundedNumber(body.monthlyTotalTarget, { minimum: 0.01 });
  const effectiveFrom = body.effectiveFrom;
  const errors = [];
  if (monthlyTotalTarget === undefined) errors.push("monthlyTotalTarget must be positive");
  if (!validDate(effectiveFrom) || !effectiveFrom.endsWith("-01")) errors.push("effectiveFrom must be the first day of a valid month");
  return errors.length ? { success: false, errors } : { success: true, data: { monthlyTotalTarget, effectiveFrom } };
}

export function validateTargetId(request) {
  const targetId = identifier(request, "targetId");
  return targetId ? { success: true, data: { targetId } } : { success: false, errors: ["targetId must be a valid UUID"] };
}

export function validateTargetUpdate(request) {
  const id = validateTargetId(request);
  const values = validateTarget(request);
  return !id.success || !values.success
    ? { success: false, errors: [...(id.errors ?? []), ...(values.errors ?? [])] }
    : { success: true, data: { targetId: id.data.targetId, values: values.data } };
}
