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
  const start = { year, month, day };
  const end = shiftLocalDate(start, { days: 1 });
  return {
    from: zonedTimeToUtc(start, timeZone).toISOString(),
    to: zonedTimeToUtc(end, timeZone).toISOString(),
  };
}

export function getMonthRange(year, month, timeZone) {
  const start = { year: Number(year), month: Number(month), day: 1 };
  const end = shiftLocalDate(start, { months: 1 });
  return {
    from: zonedTimeToUtc(start, timeZone).toISOString(),
    to: zonedTimeToUtc(end, timeZone).toISOString(),
  };
}

export function getYearRange(year, timeZone) {
  const start = { year: Number(year), month: 1, day: 1 };
  const end = { year: Number(year) + 1, month: 1, day: 1 };
  return {
    from: zonedTimeToUtc(start, timeZone).toISOString(),
    to: zonedTimeToUtc(end, timeZone).toISOString(),
  };
}

function shiftLocalDate(parts, { days = 0, months = 0, years = 0 } = {}) {
  const date = new Date(Date.UTC(parts.year + years, parts.month - 1 + months, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function getPeriodRange(period, timeZone, now = new Date()) {
  if (period === "all") return { from: null, to: null };
  const local = zonedParts(now, timeZone);
  let start;
  let end;

  if (period === "today") {
    start = { year: local.year, month: local.month, day: local.day };
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

  return {
    from: zonedTimeToUtc(start, timeZone).toISOString(),
    to: zonedTimeToUtc(end, timeZone).toISOString(),
  };
}

export function getBucketKey(dateValue, granularity, timeZone) {
  const parts = zonedParts(new Date(dateValue), timeZone);
  const year = String(parts.year);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  if (granularity === "yearly") return year;
  if (granularity === "monthly") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}
