import { getSupabaseAdmin } from "../config/supabaseAdmin.js";
import { AppError } from "../shared/errors/AppError.js";

export function createAuthenticate({ getAdminClient = getSupabaseAdmin } = {}) {
  return async function authenticate(request, _response, next) {
    try {
      const authorization = request.headers.authorization ?? "";
      const [scheme, token] = authorization.split(" ");
      if (scheme !== "Bearer" || !token) throw new AppError(401, "A valid Supabase access token is required", "UNAUTHORIZED");

      const supabase = getAdminClient();
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) throw new AppError(401, "Invalid or expired access token", "UNAUTHORIZED");

      const user = userData.user;
      const requestedBusinessId = request.headers["x-business-id"];
      let membershipQuery = supabase
        .from("business_members")
        .select("business_id, role, status, businesses!inner(id, timezone, status)")
        .eq("user_id", user.id)
        .neq("status", "removed");
      if (requestedBusinessId) membershipQuery = membershipQuery.eq("business_id", requestedBusinessId);

      const [profileResult, platformResult, membershipResult] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, account_type, account_status, requires_password_setup").eq("id", user.id).maybeSingle(),
        supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
        membershipQuery.order("joined_at", { ascending: true }).limit(1),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (platformResult.error) throw platformResult.error;
      if (membershipResult.error) throw membershipResult.error;
      if (!profileResult.data) throw new AppError(403, "User profile is not provisioned", "PROFILE_REQUIRED");

      const membership = membershipResult.data?.[0] ?? null;
      const business = Array.isArray(membership?.businesses) ? membership.businesses[0] : membership?.businesses;
      request.auth = {
        user,
        profile: profileResult.data,
        isPlatformAdmin: Boolean(platformResult.data),
        businessId: membership?.business_id ?? null,
        role: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
        businessStatus: business?.status ?? null,
        timezone: business?.timezone ?? "UTC",
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const authenticate = createAuthenticate();
