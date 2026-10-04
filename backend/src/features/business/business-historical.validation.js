import { getBusinessDateKey } from "../../shared/utils/timeRange.js";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONEY_PATTERN = /^(0|[1-9]\d{0,11})(?:\.(\d{1,2}))?$/;
const RATE_PATTERN = /^(0|[1-9]\d{0,11})(?:\.(\d{1,6}))?$/;
// Keep parsed amounts below the range where a JavaScript Number loses cent precision.
const MAX_MONEY_CENTS = 99_999_999_999_999n;
const MAX_RECORDS = 3660;
const ACTIVITY_TYPES = new Set(["playstation", "billiard", "pingpong"]);
const SOURCE_TYPES = new Set(["manual_ledger", "spreadsheet", "accounting_export", "other"]);

function exactKeys(value, allowed, path, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}.${key} is not supported`);
  }
  return true;
}

function dateIsValid(value) {
  const match = typeof value === "string" ? value.match(DATE_PATTERN) : null;
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function shiftDate(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function decimal(value, pattern, path, errors, { positive = false } = {}) {
  if (typeof value !== "string" || !pattern.test(value)) {
    errors.push(`${path} must be a non-negative decimal string`);
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || (positive ? number <= 0 : number < 0)) {
    errors.push(`${path} must be ${positive ? "greater than zero" : "non-negative"}`);
    return null;
  }
  return number;
}

function money(value, path, errors) {
  const number = decimal(value, MONEY_PATTERN, path, errors);
  if (number === null) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > MAX_MONEY_CENTS) {
    errors.push(`${path} exceeds the safe money limit`);
    return null;
  }
  return { value: number, cents, canonical: `${whole}.${fraction.padEnd(2, "0")}` };
}

function rate(value, path, errors) {
  const number = decimal(value, RATE_PATTERN, path, errors, { positive: true });
  if (number === null) return null;
  const [whole, fraction = ""] = value.split(".");
  return { value: number, canonical: `${whole}.${fraction.padEnd(6, "0")}` };
}

function normalizeMoneyBlock(value, path, errors, { activity = false } = {}) {
  const allowed = activity
    ? ["total", "currency", "exchange_rate_to_usd", "by_activity"]
    : ["total", "currency", "exchange_rate_to_usd"];
  if (!exactKeys(value, allowed, path, errors)) return null;
  const total = money(value.total, `${path}.total`, errors);
  const currency = value.currency;
  if (!["USD", "LBP"].includes(currency)) errors.push(`${path}.currency must be USD or LBP`);
  let exchangeRate;
  if (currency === "LBP") {
    exchangeRate = rate(value.exchange_rate_to_usd, `${path}.exchange_rate_to_usd`, errors);
  } else if (value.exchange_rate_to_usd === undefined) {
    exchangeRate = { value: 1, canonical: "1.000000" };
  } else {
    exchangeRate = rate(value.exchange_rate_to_usd, `${path}.exchange_rate_to_usd`, errors);
    if (exchangeRate && exchangeRate.value !== 1) errors.push(`${path}.exchange_rate_to_usd must equal 1 for USD`);
  }
  if (!total || !exchangeRate || !["USD", "LBP"].includes(currency)) return null;
  const normalized = {
    total: total.canonical,
    currency,
    exchange_rate_to_usd: exchangeRate.canonical,
    usd: (currency === "LBP" ? total.value / exchangeRate.value : total.value).toFixed(2),
  };

  if (activity && value.by_activity !== undefined) {
    if (!Array.isArray(value.by_activity) || !value.by_activity.length) {
      errors.push(`${path}.by_activity must be a non-empty array when supplied`);
      return normalized;
    }
    const seen = new Set();
    let activityCents = 0n;
    normalized.by_activity = value.by_activity.map((item, index) => {
      const itemPath = `${path}.by_activity[${index}]`;
      if (!exactKeys(item, ["activity_type", "revenue"], itemPath, errors)) return null;
      if (!ACTIVITY_TYPES.has(item.activity_type)) errors.push(`${itemPath}.activity_type is invalid`);
      if (seen.has(item.activity_type)) errors.push(`${itemPath}.activity_type is duplicated`);
      seen.add(item.activity_type);
      const itemRevenue = money(item.revenue, `${itemPath}.revenue`, errors);
      if (!itemRevenue) return null;
      activityCents += itemRevenue.cents;
      return {
        activity_type: item.activity_type,
        revenue: itemRevenue.canonical,
        usd: (currency === "LBP" ? itemRevenue.value / exchangeRate.value : itemRevenue.value).toFixed(2),
      };
    }).filter(Boolean).sort((left, right) => left.activity_type.localeCompare(right.activity_type));
    const difference = activityCents > total.cents ? activityCents - total.cents : total.cents - activityCents;
    if (difference > 1n) errors.push(`${path}.by_activity revenue must reconcile with ${path}.total`);
  }
  return normalized;
}

function normalizeOperations(value, path, errors) {
  if (!exactKeys(value, ["completed_sessions", "total_duration_seconds"], path, errors)) return null;
  const normalized = {};
  if (value.completed_sessions !== undefined) {
    if (!Number.isInteger(value.completed_sessions) || value.completed_sessions < 0 || value.completed_sessions > 2147483647) {
      errors.push(`${path}.completed_sessions must be a non-negative integer`);
    } else normalized.completed_sessions = value.completed_sessions;
  }
  if (value.total_duration_seconds !== undefined) {
    if (!Number.isSafeInteger(value.total_duration_seconds) || value.total_duration_seconds < 0) {
      errors.push(`${path}.total_duration_seconds must be a non-negative safe integer`);
    } else normalized.total_duration_seconds = value.total_duration_seconds;
  }
  if (!Object.keys(normalized).length) errors.push(`${path} must contain at least one supported value`);
  return normalized;
}

export function validateHistoricalPayload(payload, { businessDate }) {
  const errors = [];
  if (!exactKeys(payload, ["schema_version", "data_type", "period_type", "coverage", "source", "records"], "file", errors)) {
    return { success: false, errors };
  }
  if (payload.schema_version !== "1.0") errors.push('schema_version must equal "1.0"');
  if (payload.data_type !== "historical_business_data") errors.push('data_type must equal "historical_business_data"');
  if (payload.period_type !== "daily") errors.push('period_type must equal "daily"');

  let coverage = null;
  if (exactKeys(payload.coverage, ["start_business_date", "end_business_date", "mode"], "coverage", errors)) {
    const start = payload.coverage.start_business_date;
    const end = payload.coverage.end_business_date;
    if (!dateIsValid(start)) errors.push("coverage.start_business_date must be a valid YYYY-MM-DD date");
    if (!dateIsValid(end)) errors.push("coverage.end_business_date must be a valid YYYY-MM-DD date");
    if (dateIsValid(start) && dateIsValid(end) && end < start) errors.push("coverage.end_business_date cannot be before the start");
    if (!["complete", "partial"].includes(payload.coverage.mode)) errors.push("coverage.mode must be complete or partial");
    coverage = { start_business_date: start, end_business_date: end, mode: payload.coverage.mode };
  }

  let source;
  if (payload.source !== undefined && exactKeys(payload.source, ["type", "reference"], "source", errors)) {
    if (!SOURCE_TYPES.has(payload.source.type)) errors.push("source.type is invalid");
    if (payload.source.reference !== undefined && (typeof payload.source.reference !== "string" || payload.source.reference.trim().length > 200)) {
      errors.push("source.reference must contain at most 200 characters");
    }
    const reference = typeof payload.source.reference === "string" ? payload.source.reference.trim() : "";
    source = { type: payload.source.type, ...(reference ? { reference } : {}) };
  }

  if (!Array.isArray(payload.records) || !payload.records.length) errors.push("records must be a non-empty array");
  if (Array.isArray(payload.records) && payload.records.length > MAX_RECORDS) errors.push(`records cannot exceed ${MAX_RECORDS} daily entries`);
  const seenDates = new Set();
  const records = Array.isArray(payload.records) ? payload.records.map((record, index) => {
    const path = `records[${index}]`;
    if (!exactKeys(record, ["business_date", "revenue", "expenses", "operations", "notes"], path, errors)) return null;
    const date = record.business_date;
    if (!dateIsValid(date)) errors.push(`${path}.business_date must be a valid YYYY-MM-DD date`);
    if (dateIsValid(date) && date >= businessDate) errors.push(`${path}.business_date must be a closed historical business day`);
    if (seenDates.has(date)) errors.push(`${path}.business_date is duplicated`);
    seenDates.add(date);
    if (coverage && dateIsValid(date) && (date < coverage.start_business_date || date > coverage.end_business_date)) {
      errors.push(`${path}.business_date is outside the declared coverage range`);
    }
    const revenue = normalizeMoneyBlock(record.revenue, `${path}.revenue`, errors, { activity: true });
    const expenses = record.expenses === undefined ? undefined
      : normalizeMoneyBlock(record.expenses, `${path}.expenses`, errors);
    const operations = record.operations === undefined ? undefined
      : normalizeOperations(record.operations, `${path}.operations`, errors);
    if (revenue && operations?.completed_sessions === 0 && Number(revenue.total) > 0) {
      errors.push(`${path} cannot declare positive revenue with zero completed sessions`);
    }
    if (record.notes !== undefined && (typeof record.notes !== "string" || record.notes.trim().length > 500)) {
      errors.push(`${path}.notes must contain at most 500 characters`);
    }
    return {
      business_date: date,
      revenue,
      ...(expenses ? { expenses } : {}),
      ...(operations ? { operations } : {}),
      ...(record.notes?.trim() ? { notes: record.notes.trim() } : {}),
    };
  }).filter(Boolean).sort((left, right) => left.business_date.localeCompare(right.business_date)) : [];

  if (coverage?.mode === "complete" && dateIsValid(coverage.start_business_date) && dateIsValid(coverage.end_business_date)) {
    const expected = [];
    for (let date = coverage.start_business_date; date <= coverage.end_business_date && expected.length <= MAX_RECORDS; date = shiftDate(date, 1)) expected.push(date);
    if (expected.length !== records.length || expected.some((date) => !seenDates.has(date))) {
      errors.push("complete coverage requires exactly one record for every declared business date");
    }
  }

  return errors.length ? { success: false, errors } : { success: true, data: {
    schema_version: "1.0",
    data_type: "historical_business_data",
    period_type: "daily",
    coverage,
    ...(source ? { source } : {}),
    records,
  } };
}

export function validateHistoricalImport(request) {
  return validateHistoricalPayload(request.body, {
    businessDate: getBusinessDateKey(new Date(), request.auth?.timezone ?? "UTC"),
  });
}
