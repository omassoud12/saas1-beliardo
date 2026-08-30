const SENSITIVE_KEY = /authorization|cookie|password|secret|token|key|credential/i;

function sanitize(value, depth = 0) {
  if (depth > 4) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitize(item, depth + 1),
  ]));
}

export function logEvent(level, event, metadata = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(metadata),
  });
  (level === "error" ? console.error : console.info)(entry);
}
