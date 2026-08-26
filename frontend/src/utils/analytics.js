export const ACTIVITY_META = {
  playstation: { label: "PlayStation", short: "PS" },
  billiard: { label: "Billiard", short: "BIL" },
  pingpong: { label: "Ping Pong", short: "PP" },
};

export const ACTIVITY_ORDER = ["playstation", "billiard", "pingpong"];

export const DEFAULT_CURRENCY = "USD";

export function formatCurrency(value, currency = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency, minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatHours(value) {
  return `${Number(value || 0).toFixed(2)} hrs`;
}

export function formatDuration(seconds) {
  const totalMinutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatDate(date, options = { month: "long", day: "numeric", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(new Date(`${date}T12:00:00Z`));
}

export function formatMonth(year, month, options = { month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

export function shiftDate(date, amount) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
