import assert from "node:assert/strict";
import test from "node:test";
import { validateClientEnv } from "../vite.config.js";

const validEnv = {
  VITE_API_URL: "https://backend.example.com/api",
  VITE_SUPABASE_URL: "https://project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "public-key",
};

test("accepts a complete production frontend configuration", () => {
  assert.doesNotThrow(() => validateClientEnv(validEnv, { requireHttps: true }));
});

test("reports every missing frontend variable", () => {
  assert.throws(
    () => validateClientEnv({}),
    /VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY/,
  );
});

test("rejects malformed URLs and insecure Netlify URLs", () => {
  assert.throws(
    () => validateClientEnv({ ...validEnv, VITE_API_URL: "not-a-url" }),
    /VITE_API_URL must be a valid absolute URL/,
  );
  assert.throws(
    () => validateClientEnv({ ...validEnv, VITE_API_URL: "http://backend.example.com/api" }, { requireHttps: true }),
    /VITE_API_URL must use https on Netlify/,
  );
});
