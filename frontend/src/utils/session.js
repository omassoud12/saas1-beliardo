export function getElapsedSeconds(table, now = Date.now()) {
  if (table.status === "available" || !table.sessionStartAt) return 0;

  const endpoint = table.status === "paused" ? table.pausedAt : now;
  const elapsedMs = Math.max(
    0,
    endpoint - table.sessionStartAt - table.totalPausedMs,
  );

  return Math.floor(elapsedMs / 1000);
}

export function getCurrentCost(table, now = Date.now()) {
  const controllerCount = table.type === "playstation" ? (Number(table.controllerCount) || 1) : 1;
  return (getElapsedSeconds(table, now) / 3600) * table.hourlyRate * controllerCount;
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value) {
  return moneyFormatter.format(value || 0);
}

export function formatTimeInput(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function timeInputToTimestamp(value, referenceTimestamp = Date.now()) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const date = new Date(referenceTimestamp);
  date.setHours(hours, minutes, 0, 0);

  // A time later than "now" is assumed to belong to the previous day.
  if (date.getTime() > referenceTimestamp + 60_000) {
    date.setDate(date.getDate() - 1);
  }

  return date.getTime();
}

function zonedParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function formatDateTimeInput(timestamp, timeZone) {
  if (!timestamp) return "";
  const parts = zonedParts(timestamp, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatZonedTimeInput(timestamp, timeZone) {
  if (!timestamp) return "";
  const parts = zonedParts(timestamp, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function zonedDateTimeToTimestamp(value, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let candidate = desiredUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(candidate, timeZone);
    const representedUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    candidate += desiredUtc - representedUtc;
  }
  return formatDateTimeInput(candidate, timeZone) === value ? candidate : null;
}

export function zonedTimeToTimestamp(value, timeZone, referenceTimestamp = Date.now()) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const parts = zonedParts(referenceTimestamp, timeZone);
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const todayCandidate = zonedDateTimeToTimestamp(`${today}T${value}`, timeZone);
  if (todayCandidate !== null && todayCandidate <= referenceTimestamp + 60_000) return todayCandidate;

  const previousDate = new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1,
  ));
  const previousDay = [
    previousDate.getUTCFullYear(),
    String(previousDate.getUTCMonth() + 1).padStart(2, "0"),
    String(previousDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return zonedDateTimeToTimestamp(`${previousDay}T${value}`, timeZone);
}

function clippedIntervalSeconds(start, end, sessionStart, selectedEnd) {
  const clippedStart = Math.max(new Date(start).getTime(), sessionStart);
  const clippedEnd = Math.min(new Date(end).getTime(), selectedEnd);
  return Number.isFinite(clippedStart) && Number.isFinite(clippedEnd)
    ? Math.max(0, Math.floor((clippedEnd - clippedStart) / 1000))
    : 0;
}

export function getAdjustedSessionPreview(station, selectedEnd) {
  const sessionStart = Number(station.sessionStartAt);
  const intervals = station.pauseIntervals ?? [];
  let pausedSeconds = intervals.reduce((total, interval) => total + clippedIntervalSeconds(
    interval.startedAt, interval.endedAt, sessionStart, selectedEnd,
  ), 0);
  const trackedCompletedSeconds = intervals.reduce((total, interval) => total + clippedIntervalSeconds(
    interval.startedAt, interval.endedAt, sessionStart, Number.POSITIVE_INFINITY,
  ), 0);
  if (station.status === "paused" && station.pausedAt) {
    pausedSeconds += clippedIntervalSeconds(station.pausedAt, selectedEnd, sessionStart, selectedEnd);
  }
  const elapsedSeconds = Math.max(0, Math.floor((selectedEnd - sessionStart) / 1000) - pausedSeconds);
  const controllerCount = station.type === "playstation" ? (Number(station.controllerCount) || 1) : 1;
  return {
    elapsedSeconds,
    pausedSeconds,
    cost: Math.round(((elapsedSeconds / 3600) * station.hourlyRate * controllerCount) * 100) / 100,
    hasUntrackedPause: Math.floor((station.totalPausedMs ?? 0) / 1000) > trackedCompletedSeconds,
  };
}

export function formatLoungeDateTime(timestamp, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}
