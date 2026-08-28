import test from "node:test";
import assert from "node:assert/strict";
import { getTrustProxyHops, loadEnv, parseCorsOrigins } from "../src/config/env.js";

const secrets = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

test("production configuration requires frontend and CORS URLs", () => {
  assert.throws(
    () => loadEnv({ ...secrets, NODE_ENV: "production" }),
    /CORS_ORIGIN, FRONTEND_URL/,
  );
});

test("production configuration normalizes origins and defaults to one trusted proxy", () => {
  const config = loadEnv({
    ...secrets,
    NODE_ENV: "production",
    CORS_ORIGIN: "https://app.example.com/, https://admin.example.com",
    FRONTEND_URL: "https://app.example.com/",
  });
  assert.deepEqual(config.corsOrigins, ["https://app.example.com", "https://admin.example.com"]);
  assert.equal(config.frontendUrl, "https://app.example.com");
  assert.equal(config.trustProxyHops, 1);
});

test("CORS origins reject paths and trust proxy hops reject unsafe values", () => {
  assert.throws(() => parseCorsOrigins("https://app.example.com/path"), /origins only/);
  assert.throws(() => getTrustProxyHops({ TRUST_PROXY_HOPS: "99" }), /between 0 and 10/);
});
