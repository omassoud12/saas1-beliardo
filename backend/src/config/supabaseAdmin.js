import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

let adminClient;

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  const env = getEnv();

  adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return adminClient;
}
