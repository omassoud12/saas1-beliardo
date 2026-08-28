import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { businessRepository } from "../src/features/business/business.repository.js";

dotenv.config({ path: ".env" });
console.log(JSON.stringify({ hasDatabaseUrl: Boolean(process.env.DATABASE_URL) }));
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const businesses = await client.from("businesses").select("id, timezone").limit(1);
if (businesses.error) throw businesses.error;
if (!businesses.data?.length) {
  console.log("No business row is available for the diagnostic.");
  process.exit(0);
}
const business = businesses.data[0];
const result = await client.rpc("get_business_analytics", {
  p_business_id: business.id,
  p_from: "2026-08-27T03:00:00.000Z",
  p_to: "2026-08-28T03:00:00.000Z",
  p_bucket: "hour",
  p_timezone: business.timezone || "UTC",
  p_business_day_start_hour: 6,
});
console.log(JSON.stringify(result.error ? {
  ok: false,
  code: result.error.code,
  message: result.error.message,
  details: result.error.details,
  hint: result.error.hint,
} : { ok: true, rowCount: result.data?.length ?? 0 }));

const fallbackResult = await businessRepository.aggregate(
  business.id,
  { from: "2026-08-27T03:00:00.000Z", to: "2026-08-28T03:00:00.000Z" },
  "hour",
  business.timezone || "UTC",
);
console.log(JSON.stringify({ compatibilityPathOk: true, rowCount: fallbackResult.length }));
