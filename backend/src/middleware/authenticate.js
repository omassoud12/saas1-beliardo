import { getSupabaseAdmin } from "../config/supabaseAdmin.js";
import { AppError } from "../shared/errors/AppError.js";

export function createAuthenticate({ getAdminClient = getSupabaseAdmin } = {}) {
  return async function authenticate(request, _response, next) {
    try {
      const authorization = request.headers.authorization ?? "";
      const [scheme, token] = authorization.split(" ");
      if (scheme !== "Bearer" || !token) {
        throw new AppError(401, "A valid Supabase access token is required", "UNAUTHORIZED");
      }

      const supabase = getAdminClient();
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) {
        throw new AppError(401, "Invalid or expired access token", "UNAUTHORIZED");
      }

      const requestedBusinessId = request.headers["x-business-id"];
      let membershipQuery = supabase
        .from("business_members")
        .select("business_id, role, businesses!inner(id, timezone)")
        .eq("user_id", userData.user.id);

      if (requestedBusinessId) {
        membershipQuery = membershipQuery.eq("business_id", requestedBusinessId);
      }

      const { data: memberships, error: membershipError } = await membershipQuery
        .order("joined_at", { ascending: true })
        .limit(1);

      if (membershipError) throw membershipError;
      const membership = memberships?.[0];
      if (!membership) {
        throw new AppError(403, "User does not belong to an authorized business", "FORBIDDEN");
      }
      const business = Array.isArray(membership.businesses)
        ? membership.businesses[0]
        : membership.businesses;

      request.auth = {
        user: userData.user,
        businessId: membership.business_id,
        role: membership.role,
        timezone: business?.timezone ?? "UTC",
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const authenticate = createAuthenticate();
