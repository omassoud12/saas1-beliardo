import { AuthClient } from "@supabase/auth-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createAuthOnlyClient(url, publishableKey) {
  const baseUrl = new URL(url.endsWith("/") ? url : `${url}/`);
  const storageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;
  const auth = new AuthClient({
    url: new URL("auth/v1", baseUrl).href,
    headers: {
      Authorization: `Bearer ${publishableKey}`,
      apikey: publishableKey,
    },
    storageKey,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  });
  return { auth };
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createAuthOnlyClient(supabaseUrl, supabaseAnonKey)
  : null;
