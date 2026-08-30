import { permissionsForAccess } from "../../shared/constants/access.js";
import { getBusinessDateKey } from "../../shared/utils/timeRange.js";
import { accessRepository } from "./access.repository.js";

export function getAccessState(auth) {
  const status = auth.profile.account_status;
  let state = status;

  if (auth.isPlatformAdmin && status === "approved") state = "platform_admin";
  else if (status === "approved" && auth.membershipStatus === "disabled") state = "disabled";
  else if (status === "approved" && auth.role === "employee" && auth.profile.requires_password_setup) state = "password_setup_required";
  else if (status === "approved" && auth.role === "owner" && auth.membershipStatus === "active" && auth.businessStatus === "approved") state = "approved_owner";
  else if (status === "approved" && auth.role === "employee" && auth.membershipStatus === "active" && auth.businessStatus === "approved") state = "active_employee";
  else if (status === "approved") state = "no_access";

  const active = ["approved_owner", "active_employee"].includes(state);
  return {
    state,
    profile: {
      id: auth.profile.id,
      email: auth.profile.email,
      fullName: auth.profile.full_name,
      accountType: auth.profile.account_type,
      accountStatus: auth.profile.account_status,
      requiresPasswordSetup: Boolean(auth.profile.requires_password_setup),
    },
    tenant: auth.businessId ? {
      id: auth.businessId,
      status: auth.businessStatus,
      timezone: auth.timezone,
      businessDate: getBusinessDateKey(new Date(), auth.timezone),
    } : null,
    membership: auth.role ? { role: auth.role, status: auth.membershipStatus } : null,
    permissions: permissionsForAccess({ role: auth.role, isPlatformAdmin: auth.isPlatformAdmin, active }),
  };
}

export async function completePasswordSetup({ userId, accessToken, password }, repository = accessRepository) {
  await repository.updateAuthPassword(accessToken, password);
  return repository.markPasswordConfigured(userId);
}
