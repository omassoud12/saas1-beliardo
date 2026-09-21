const entries = new Map();

export function readBusinessRequest(key, load, ttlMs = 15_000) {
  const now = Date.now();
  for (const [entryKey, entry] of entries) {
    if (!entry.promise && entry.expiresAt <= now) entries.delete(entryKey);
  }
  const existing = entries.get(key);
  if (existing?.value !== undefined && existing.expiresAt > now) return Promise.resolve(existing.value);
  if (existing?.promise) return existing.promise;

  const promise = Promise.resolve().then(load).then((value) => {
    if (entries.get(key)?.promise === promise) {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    return value;
  }).catch((error) => {
    if (entries.get(key)?.promise === promise) entries.delete(key);
    throw error;
  });
  entries.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

export function invalidateBusinessRequestCache(businessId) {
  const prefix = `business:${businessId || "unknown"}:`;
  for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
}

export function invalidateBusinessRequest(key) {
  entries.delete(key);
}

export function clearBusinessRequestCache() {
  entries.clear();
}
