let cachedEnv;

function httpUrl(value, name) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url;
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`);
  }
}

export function parseCorsOrigins(value) {
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean).map((origin) => {
    const url = httpUrl(origin, "CORS_ORIGIN");
    if (url.pathname !== "/" || url.search || url.hash) {
      throw new Error("CORS_ORIGIN entries must contain origins only, without paths, query strings, or fragments");
    }
    return url.origin;
  });
  if (origins.length === 0) throw new Error("CORS_ORIGIN must include at least one origin");
  return [...new Set(origins)];
}

export function getTrustProxyHops(source = process.env) {
  const fallback = source.NODE_ENV === "production" ? 1 : 0;
  const value = Number(source.TRUST_PROXY_HOPS ?? fallback);
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 10");
  }
  return value;
}

export function loadEnv(source = process.env) {
  const isProduction = source.NODE_ENV === "production";
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    ...(isProduction ? ["CORS_ORIGIN", "FRONTEND_URL", "REDIS_URL"] : []),
  ];
  const missing = required.filter((name) => !source[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    port: Number(source.PORT) || 4000,
    corsOrigins: parseCorsOrigins(source.CORS_ORIGIN ?? "http://localhost:5173"),
    frontendUrl: httpUrl(source.FRONTEND_URL ?? "http://localhost:5173", "FRONTEND_URL").origin,
    trustProxyHops: getTrustProxyHops(source),
    supabaseUrl: source.SUPABASE_URL,
    supabaseAnonKey: source.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY,
    redisUrl: source.REDIS_URL,
  };
}

export function getEnv() {
  if (cachedEnv) return cachedEnv;
  cachedEnv = loadEnv();

  return cachedEnv;
}
