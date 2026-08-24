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
  return (getElapsedSeconds(table, now) / 3600) * table.hourlyRate;
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
