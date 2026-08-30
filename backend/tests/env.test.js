import test from "node:test";
import assert from "node:assert/strict";
import { getTrustProxyHops, loadEnv, parseCorsOrigins } from "../src/config/env.js";

const secrets = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  REDIS_URL: "redis://localhost:6379",
};

test("production configuration requires frontend and CORS URLs", () => {
  assert.throws(
    () => loadEnv({ ...secrets, NODE_ENV: "production" }),
    /CORS_ORIGIN, FRONTEND_URL/,
  );
});

test("all environments require the anon key for caller-scoped RLS access", () => {
  const { SUPABASE_ANON_KEY: _removed, ...withoutAnonKey } = secrets;
  assert.throws(() => loadEnv(withoutAnonKey), /SUPABASE_ANON_KEY/);
});

test("production configuration normalizes origins and defaults to one trusted proxy", () => {
  const config = loadEnv({
    ...secrets,
    NODE_ENV: "production",
    CORS_ORIGIN: "https://app.example.com/, https://admin.example.com",
    FRONTEND_URL: "https://app.example.com/",
    REDIS_URL: secrets.REDIS_URL,
  });
  assert.deepEqual(config.corsOrigins, ["https://app.example.com", "https://admin.example.com"]);
  assert.equal(config.frontendUrl, "https://app.example.com");
  assert.equal(config.trustProxyHops, 1);
});

test("CORS origins reject paths and trust proxy hops reject unsafe values", () => {
  assert.throws(() => parseCorsOrigins("https://app.example.com/path"), /origins only/);
  assert.throws(() => getTrustProxyHops({ TRUST_PROXY_HOPS: "99" }), /between 0 and 10/);
});
