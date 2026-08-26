export const BUSINESS_DAY_START_HOUR = 6;

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second),
  };
}

function zonedTimeToUtc(localParts, timeZone) {
  const guess = Date.UTC(
    localParts.year, localParts.month - 1, localParts.day,
    localParts.hour ?? 0, localParts.minute ?? 0, localParts.second ?? 0,
  );
  let result = guess;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const actual = zonedParts(new Date(result), timeZone);
    const representedAsUtc = Date.UTC(
      actual.year, actual.month - 1, actual.day,
      actual.hour, actual.minute, actual.second,
    );
    result = guess - (representedAsUtc - result);
  }

  return new Date(result);
}

export function getDateRange(date, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const start = { year, month, day, hour: BUSINESS_DAY_START_HOUR };
  const end = shiftLocalDate(start, { days: 1 });
  end.hour = BUSINESS_DAY_START_HOUR;
  return {
    from: zonedTimeToUtc(start, timeZone).toISOString(),
    to: zonedTimeToUtc(end, timeZone).toISOString(),
  };
}

export function getMonthRange(year, month, timeZone) {
  const start = { year: Number(year), month: Number(month), day: 1, hour: BUSINESS_DAY_START_HOUR };
  const end = shiftLocalDate(start, { months: 1 });
  end.hour = BUSINESS_DAY_START_HOUR;
  return {
    from: zonedTimeToUtc(start, timeZone).toISOString(),
    to: zonedTimeToUtc(end, timeZone).toISOString(),
  };
}

export function getYearRange(year, timeZone) {
  const start = { year: Number(year), month: 1, day: 1, hour: BUSINESS_DAY_START_HOUR };
  const end = { year: Number(year) + 1, month: 1, day: 1, hour: BUSINESS_DAY_START_HOUR };
  return {
    from: zonedTimeToUtc(start, timeZone).toISOString(),
    to: zonedTimeToUtc(end, timeZone).toISOString(),
  };
}

function shiftLocalDate(parts, { days = 0, months = 0, years = 0 } = {}) {
  const date = new Date(Date.UTC(parts.year + years, parts.month - 1 + months, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function dateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getBusinessDateKey(dateValue, timeZone) {
  const local = zonedParts(new Date(dateValue), timeZone);
  const businessDate = local.hour < BUSINESS_DAY_START_HOUR
    ? shiftLocalDate(local, { days: -1 })
    : local;
  return dateKey(businessDate);
}

export function getHourlyBucketKeys({ from, to }) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  const keys = [];
  for (let timestamp = start; timestamp < end; timestamp += 60 * 60 * 1000) {
    keys.push(new Date(timestamp).toISOString().slice(0, 16));
  }
  return keys;
}

export function normalizeBusinessRange({ from, to }, timeZone) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const normalize = (value) => {
    if (!value) return value;
    return dateOnly.test(value) ? getDateRange(value, timeZone).from : new Date(value).toISOString();
  };
  return { from: normalize(from), to: normalize(to) };
}

export function getPeriodRange(period, timeZone, now = new Date()) {
  if (period === "all") return { from: null, to: null };
  const [year, month, day] = getBusinessDateKey(now, timeZone).split("-").map(Number);
  const local = { year, month, day };
  let start;
  let end;

  if (period === "today") {
    start = local;
    end = shiftLocalDate(start, { days: 1 });
  } else if (period === "week") {
    const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
    const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
    start = shiftLocalDate(local, { days: -daysSinceMonday });
    end = shiftLocalDate(start, { days: 7 });
  } else if (period === "month") {
    start = { year: local.year, month: local.month, day: 1 };
    end = shiftLocalDate(start, { months: 1 });
  } else {
    start = { year: local.year, month: 1, day: 1 };
    end = { year: local.year + 1, month: 1, day: 1 };
  }
  return getDateBoundaryRange(start, end, timeZone);
}

export function getDefaultChartRange(granularity, timeZone, now = new Date()) {
  const [year, month, day] = getBusinessDateKey(now, timeZone).split("-").map(Number);
  if (granularity === "daily") {
    const end = shiftLocalDate({ year, month, day }, { days: 1 });
    const start = shiftLocalDate(end, { days: -30 });
    return getDateBoundaryRange(start, end, timeZone);
  }
  if (granularity === "monthly") {
    const end = shiftLocalDate({ year, month, day: 1 }, { months: 1 });
    const start = shiftLocalDate(end, { months: -12 });
    return getDateBoundaryRange(start, end, timeZone);
  }
  return { from: null, to: new Date(now.getTime() + 1).toISOString() };
}

export function getBucketKey(dateValue, granularity, timeZone) {
  const businessDate = getBusinessDateKey(dateValue, timeZone);
  if (granularity === "yearly") return businessDate.slice(0, 4);
  if (granularity === "monthly") return businessDate.slice(0, 7);
  return businessDate;
}

function getDateBoundaryRange(startDate, endDate, timeZone) {
  return {
    from: zonedTimeToUtc({ ...startDate, hour: BUSINESS_DAY_START_HOUR }, timeZone).toISOString(),
    to: zonedTimeToUtc({ ...endDate, hour: BUSINESS_DAY_START_HOUR }, timeZone).toISOString(),
  };
}
