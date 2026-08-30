import { getSupabaseAdmin } from "../config/supabaseAdmin.js";
import { AppError } from "../shared/errors/AppError.js";
import { setRequestAccessToken } from "./requestContext.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      if (requestedBusinessId && !uuidPattern.test(requestedBusinessId)) {
        throw new AppError(400, "X-Business-Id must be a valid UUID", "INVALID_BUSINESS_ID");
      }
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
      setRequestAccessToken(token);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const authenticate = createAuthenticate();
