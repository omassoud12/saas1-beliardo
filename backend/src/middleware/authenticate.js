import { getSupabaseAdmin } from "../config/supabaseAdmin.js";
import { AppError } from "../shared/errors/AppError.js";

export function createAuthenticate({ getAdminClient = getSupabaseAdmin } = {}) {
  return async function authenticate(request, _response, next) {
    try {
      const authorization = request.headers.authorization ?? "";
      const [scheme, token] = authorization.split(" ");
      if (scheme !== "Bearer" || !token) throw new AppError(401, "A valid Supabase access token is required", "UNAUTHORIZED");

      const supabase = getAdminClient();
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (claimsError || typeof userId !== "string" || !userId) {
        throw new AppError(401, "Invalid or expired access token", "UNAUTHORIZED");
      }

      const requestedBusinessId = request.headers["x-business-id"];
      const { data: contexts, error: contextError } = await supabase.rpc("get_request_access_context", {
        p_user_id: userId,
        p_business_id: requestedBusinessId || null,
      });
      if (contextError) throw contextError;
      const context = contexts?.[0];
      if (!context?.profile) throw new AppError(403, "User profile is not provisioned", "PROFILE_REQUIRED");

      request.auth = {
        user: { id: userId, email: context.profile.email },
        profile: context.profile,
        isPlatformAdmin: Boolean(context.is_platform_admin),
        businessId: context.business_id ?? null,
        role: context.role ?? null,
        membershipStatus: context.membership_status ?? null,
        businessStatus: context.business_status ?? null,
        timezone: context.timezone ?? "UTC",
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const authenticate = createAuthenticate();
