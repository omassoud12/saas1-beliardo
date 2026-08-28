import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const requiredClientVariables = [
  "VITE_API_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
];

export function validateClientEnv(env, { requireHttps = false } = {}) {
  const missing = requiredClientVariables.filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing frontend environment variables: ${missing.join(", ")}`);
  }

  for (const name of ["VITE_API_URL", "VITE_SUPABASE_URL"]) {
    let url;
    try {
      url = new URL(env[name]);
    } catch {
      throw new Error(`${name} must be a valid absolute URL`);
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`${name} must use http or https`);
    }
    if (requireHttps && url.protocol !== "https:") {
      throw new Error(`${name} must use https on Netlify`);
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "production") {
    validateClientEnv(env, { requireHttps: env.NETLIFY === "true" });
  }

  return {
    plugins: [react()],
  };
});
