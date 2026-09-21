import { getDateRange, getMonthRange, getYearRange } from "../../shared/utils/timeRange.js";
import { getWeekStartDate } from "../../shared/utils/timeRange.js";
import { daysBetween, shiftDateKey } from "./business-analysis.calculations.js";

function monthKey(year, month) { return `${year}-${String(month).padStart(2, "0")}`; }
function daysInMonth(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function shiftMonth(year, month, amount) {
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function rangeFromDates(startDate, endDateExclusive, timezone) {
  return {
    startDate,
    endDateExclusive,
    from: getDateRange(startDate, timezone).from,
    to: getDateRange(shiftDateKey(endDateExclusive, -1), timezone).to,
    days: daysBetween(startDate, endDateExclusive),
  };
}

function clipToEquivalentElapsed(current, previous, now) {
  const currentStart = new Date(current.from).getTime();
  const currentEnd = new Date(current.to).getTime();
  const previousStart = new Date(previous.from).getTime();
  const previousEnd = new Date(previous.to).getTime();
  const currentTo = Math.min(currentEnd, Math.max(currentStart, new Date(now).getTime()));
  const elapsed = currentTo - currentStart;
  const previousTo = Math.min(previousEnd, previousStart + elapsed);
  return {
    current: { ...current, to: new Date(currentTo).toISOString(), isPartial: currentTo < currentEnd },
    previous: { ...previous, to: new Date(previousTo).toISOString(), isPartial: previousTo < previousEnd },
  };
}

export function resolveAnalysisPeriods({ period, date, year, month, businessDate, timezone, now = new Date() }) {
  if (period === "daily") {
    const previousDate = shiftDateKey(date, -1);
    const ranges = {
      current: { ...rangeFromDates(date, shiftDateKey(date, 1), timezone), kind: "day", date, isPartial: false },
      previous: { ...rangeFromDates(previousDate, date, timezone), kind: "day", date: previousDate, isPartial: false },
    };
    return date === businessDate ? clipToEquivalentElapsed(ranges.current, ranges.previous, now) : ranges;
  }

  if (period === "weekly") {
    const currentStart = getWeekStartDate(date);
    const currentFullEnd = shiftDateKey(currentStart, 7);
    const isPartial = businessDate >= currentStart && businessDate < currentFullEnd;
    const currentEnd = isPartial ? shiftDateKey(businessDate, 1) : currentFullEnd;
    const previousStart = shiftDateKey(currentStart, -7);
    const previousEnd = isPartial ? shiftDateKey(previousStart, daysBetween(currentStart, currentEnd)) : currentStart;
    const ranges = {
      current: { ...rangeFromDates(currentStart, currentEnd, timezone), kind: "week", date: currentStart, isPartial },
      previous: { ...rangeFromDates(previousStart, previousEnd, timezone), kind: "week", date: previousStart, isPartial },
    };
    return isPartial ? clipToEquivalentElapsed(ranges.current, ranges.previous, now) : ranges;
  }

  if (period === "monthly") {
    const selectedKey = monthKey(year, month);
    const currentKey = businessDate.slice(0, 7);
    const isPartial = selectedKey === currentKey;
    const currentStart = `${selectedKey}-01`;
    const currentEnd = isPartial ? shiftDateKey(businessDate, 1) : shiftMonth(year, month, 1);
    const currentEndDate = typeof currentEnd === "string" ? currentEnd : `${monthKey(currentEnd.year, currentEnd.month)}-01`;
    const prior = shiftMonth(year, month, -1);
    const priorStart = `${monthKey(prior.year, prior.month)}-01`;
    const elapsedDays = daysBetween(currentStart, currentEndDate);
    const priorDays = Math.min(elapsedDays, daysInMonth(prior.year, prior.month));
    const priorEnd = isPartial ? shiftDateKey(priorStart, priorDays) : currentStart;
    const ranges = {
      current: { ...rangeFromDates(currentStart, currentEndDate, timezone), kind: "month", year, month, isPartial },
      previous: { ...rangeFromDates(priorStart, priorEnd, timezone), kind: "month", year: prior.year, month: prior.month, isPartial },
    };
    return isPartial ? clipToEquivalentElapsed(ranges.current, ranges.previous, now) : ranges;
  }

  const selectedYear = Number(year);
  const currentYear = Number(businessDate.slice(0, 4));
  const isPartial = selectedYear === currentYear;
  const currentStart = `${selectedYear}-01-01`;
  const currentEnd = isPartial ? shiftDateKey(businessDate, 1) : `${selectedYear + 1}-01-01`;
  const previousYear = selectedYear - 1;
  const previousStart = `${previousYear}-01-01`;
  let previousEnd = `${selectedYear}-01-01`;
  if (isPartial) {
    const monthDay = businessDate.slice(5);
    const comparable = `${previousYear}-${monthDay}`;
    const valid = !Number.isNaN(new Date(`${comparable}T12:00:00Z`).getTime())
      && new Date(`${comparable}T12:00:00Z`).toISOString().slice(0, 10) === comparable;
    previousEnd = shiftDateKey(valid ? comparable : `${previousYear}-02-28`, 1);
  }
  const ranges = {
    current: { ...rangeFromDates(currentStart, currentEnd, timezone), kind: "year", year: selectedYear, isPartial },
    previous: { ...rangeFromDates(previousStart, previousEnd, timezone), kind: "year", year: previousYear, isPartial },
  };
  return isPartial ? clipToEquivalentElapsed(ranges.current, ranges.previous, now) : ranges;
}

export function historyRange(currentStartDate, businessCreatedDate, timezone) {
  const date = new Date(`${currentStartDate}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 3, 1);
  const threeMonthsBack = date.toISOString().slice(0, 10);
  const ninetyDaysBack = shiftDateKey(currentStartDate, -90);
  const desired = threeMonthsBack < ninetyDaysBack ? threeMonthsBack : ninetyDaysBack;
  const startDate = businessCreatedDate > desired ? businessCreatedDate : desired;
  return rangeFromDates(startDate, currentStartDate, timezone);
}

export function fullRangeForConfig({ period, date, year, month, timezone }) {
  if (period === "daily") return getDateRange(date, timezone);
  if (period === "monthly") return getMonthRange(year, month, timezone);
  return getYearRange(year, timezone);
}
