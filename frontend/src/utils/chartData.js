import { ACTIVITY_ORDER } from "./analytics.js";

const aliases = {
  playstation: "playstation", ps: "playstation", ps4: "playstation", ps5: "playstation", console: "playstation",
  billiard: "billiard", billiards: "billiard", pool: "billiard",
  pingpong: "pingpong", ping_pong: "pingpong", table_tennis: "pingpong", tabletennis: "pingpong",
};

export function normalizeActivityType(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return aliases[normalized] ?? "unknown";
}

function emptyRow(key, label) {
  return { key, label, playstation: 0, billiard: 0, pingpong: 0, total: 0, _unknown: 0, _unknownTypes: [] };
}

export function buildRevenueSeries(buckets, labelFormatter = (key) => key) {
  return (buckets ?? []).map((bucket) => {
    const row = emptyRow(bucket.key, labelFormatter(bucket.key));
    for (const activity of bucket.activities ?? []) {
      const type = normalizeActivityType(activity.type);
      const value = Number(activity.revenue || 0);
      if (ACTIVITY_ORDER.includes(type)) row[type] += value;
      else {
        row._unknown += value;
        row._unknownTypes.push(String(activity.type || "unknown"));
      }
    }
    row.total = ACTIVITY_ORDER.reduce((sum, type) => sum + row[type], 0);
    return row;
  });
}

function sessionInterval(session, periodStart, periodEnd) {
  const rawStart = new Date(session.startedAt).getTime();
  if (!Number.isFinite(rawStart)) return null;
  let rawEnd = session.endedAt ? new Date(session.endedAt).getTime() : periodEnd;
  if (session.status === "paused" && session.pausedAt) {
    rawEnd = Math.min(rawEnd, new Date(session.pausedAt).getTime());
  }
  const start = Math.max(rawStart, periodStart);
  const end = Math.min(Number.isFinite(rawEnd) ? rawEnd : periodEnd, periodEnd);
  return end > start ? { start, end, type: normalizeActivityType(session.activity) } : null;
}

function maximumConcurrency(intervals, bucketStart, bucketEnd, type) {
  const changes = new Map();
  for (const interval of intervals) {
    if (interval.type !== type || interval.start >= bucketEnd || interval.end <= bucketStart) continue;
    const start = Math.max(interval.start, bucketStart);
    const end = Math.min(interval.end, bucketEnd);
    changes.set(start, (changes.get(start) ?? 0) + 1);
    changes.set(end, (changes.get(end) ?? 0) - 1);
  }
  let active = 0;
  let maximum = 0;
  for (const timestamp of [...changes.keys()].sort((a, b) => a - b)) {
    active += changes.get(timestamp);
    maximum = Math.max(maximum, active);
  }
  return maximum;
}

export function buildConcurrencyBuckets(sessions, period, intervalMinutes = 60) {
  const start = new Date(period?.from).getTime();
  const end = new Date(period?.to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const intervalMs = intervalMinutes * 60 * 1000;
  const intervals = (sessions ?? []).map((session) => sessionInterval(session, start, end)).filter(Boolean);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: period.timezone || "UTC", hour: "numeric",
    ...(intervalMinutes < 60 ? { minute: "2-digit" } : {}),
  });
  const tooltipFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: period.timezone || "UTC", hour: "numeric", minute: "2-digit",
  });
  const rows = [];
  for (let bucketStart = start; bucketStart < end; bucketStart += intervalMs) {
    const row = emptyRow(new Date(bucketStart).toISOString(), formatter.format(new Date(bucketStart)));
    row.tooltipLabel = tooltipFormatter.format(new Date(bucketStart));
    for (const type of ACTIVITY_ORDER) row[type] = maximumConcurrency(intervals, bucketStart, Math.min(bucketStart + intervalMs, end), type);
    row.total = ACTIVITY_ORDER.reduce((sum, type) => sum + row[type], 0);
    row._unknown = maximumConcurrency(intervals, bucketStart, Math.min(bucketStart + intervalMs, end), "unknown");
    rows.push(row);
  }
  return rows;
}

export function hasChartData(data) {
  return (data ?? []).some((row) => ACTIVITY_ORDER.some((type) => Number(row[type]) > 0));
}

export function combinedTotal(row) {
  return ACTIVITY_ORDER.reduce((sum, type) => sum + Number(row?.[type] || 0), 0);
}
