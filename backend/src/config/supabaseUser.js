import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

export function createSupabaseUserClient(accessToken, env = getEnv()) {
  if (!env.supabaseAnonKey) {
    throw new Error("SUPABASE_ANON_KEY is required for user-scoped database access");
  }
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
