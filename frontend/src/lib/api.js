import { supabase } from "./supabase";

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");

async function request(path, options = {}) {
  if (!supabase) throw new Error("Supabase frontend environment variables are required");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Authentication is required");

  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? "API request failed");
  return payload;
}

export async function fetchStations() {
  const payload = await request("/stations");
  return payload.data.stations;
}

export async function syncStations(stations) {
  const payload = await request("/stations", {
    method: "PUT",
    body: JSON.stringify({ stations }),
  });
  return payload.data.stations;
}
