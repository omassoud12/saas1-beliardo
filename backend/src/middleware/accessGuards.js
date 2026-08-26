import { AppError } from "../shared/errors/AppError.js";

function rejectForStatus(request) {
  const status = request.auth?.profile?.account_status;
  if (request.auth?.profile?.requires_password_setup) return new AppError(403, "Set a password before continuing", "PASSWORD_SETUP_REQUIRED");
  if (request.auth?.membershipStatus === "disabled") return new AppError(403, "Tenant membership is disabled", "MEMBERSHIP_DISABLED");
  if (["suspended", "deleted", "rejected"].includes(request.auth?.businessStatus)) return new AppError(403, "Tenant is not active", "TENANT_INACTIVE");
  const codes = {
    pending_email: [403, "Confirm your email before continuing", "EMAIL_CONFIRMATION_REQUIRED"],
    pending_approval: [403, "Account is waiting for platform approval", "PENDING_APPROVAL"],
    rejected: [403, "Account registration was rejected", "ACCOUNT_REJECTED"],
    suspended: [403, "Account is suspended", "ACCOUNT_SUSPENDED"],
    deleted: [403, "Account is no longer active", "ACCOUNT_DELETED"],
  };
  return new AppError(...(codes[status] ?? [403, "Account is not authorized", "FORBIDDEN"]));
}

export function requirePlatformAdmin(request, _response, next) {
  if (request.auth?.isPlatformAdmin && request.auth.profile.account_status === "approved") return next();
  return next(rejectForStatus(request));
}

export function requireApprovedOwner(request, _response, next) {
  if (
    request.auth?.profile?.account_status === "approved"
    && !request.auth.profile.requires_password_setup
    && request.auth.role === "owner"
    && request.auth.membershipStatus === "active"
    && request.auth.businessStatus === "approved"
  ) return next();
  return next(rejectForStatus(request));
}

export function requireHomeAccess(request, _response, next) {
  if (
    request.auth?.profile?.account_status === "approved"
    && !request.auth.profile.requires_password_setup
    && ["owner", "employee"].includes(request.auth.role)
    && request.auth.membershipStatus === "active"
    && request.auth.businessStatus === "approved"
  ) return next();
  return next(rejectForStatus(request));
}
