import { AppError } from "../../shared/errors/AppError.js";
import { platformRepository } from "./platform.repository.js";

export function createPlatformService({ repository = platformRepository } = {}) {
  async function changeOwnerStatus({ actorUserId, userId, action }) {
    const result = await repository.transitionUser(actorUserId, userId, action);
    if (result.outcome === "self_change_denied") throw new AppError(409, "Administrators cannot change their own access here", "SELF_CHANGE_DENIED");
    if (result.outcome === "forbidden") throw new AppError(403, "Platform administrator access is required", "FORBIDDEN");
    if (result.outcome === "not_found") throw new AppError(404, "Owner account not found", "OWNER_NOT_FOUND");
    if (result.outcome !== "updated") throw new AppError(409, "Owner status transition is invalid", "INVALID_STATUS_TRANSITION");
    await repository.setAuthBan(userId, ["reject", "suspend"].includes(action));
    return { userId, action, status: result.account_status };
  }

  return {
    async listUsers() {
      const profiles = await repository.listManagedProfiles();
      const memberships = await repository.listMemberships(profiles.map((item) => item.id));
      const businesses = await repository.listBusinesses([...new Set(memberships.map((item) => item.business_id))]);
      const membershipByUser = new Map(memberships.map((item) => [item.user_id, item]));
      const businessById = new Map(businesses.map((item) => [item.id, item]));
      return profiles.map((profile) => { const membership = membershipByUser.get(profile.id); return { id: profile.id, email: profile.email, fullName: profile.full_name, accountType: profile.account_type, status: profile.account_status, membershipStatus: membership?.status ?? null, business: membership ? businessById.get(membership.business_id) ?? null : null, createdAt: profile.created_at }; });
    },
    async listOwners() {
      const profiles = await repository.listOwnerProfiles();
      const memberships = await repository.listOwnerMemberships(profiles.map((item) => item.id));
      const businesses = await repository.listBusinesses([...new Set(memberships.map((item) => item.business_id))]);
      const membershipByUser = new Map(memberships.map((item) => [item.user_id, item]));
      const businessById = new Map(businesses.map((item) => [item.id, item]));
      return profiles.map((profile) => {
        const membership = membershipByUser.get(profile.id);
        return {
          id: profile.id, email: profile.email, fullName: profile.full_name,
          status: profile.account_status, createdAt: profile.created_at,
          membershipStatus: membership?.status ?? null,
          business: membership ? businessById.get(membership.business_id) ?? null : null,
        };
      });
    },
    changeOwnerStatus,
    async updateUser({ actorUserId, userId, fullName }) {
      const result = await repository.updateUserName(actorUserId, userId, fullName);
      if (result.outcome === "forbidden") throw new AppError(403, "Platform administrator access is required", "FORBIDDEN");
      if (result.outcome === "not_found") throw new AppError(404, "User not found", "USER_NOT_FOUND");
      if (result.outcome !== "updated" || !result.profile_record) throw new AppError(400, "Full name is invalid", "INVALID_FULL_NAME");
      return { id: result.profile_record.id, fullName: result.profile_record.full_name };
    },
    async changeUserStatus({ actorUserId, userId, action }) {
      const result = await repository.transitionUser(actorUserId, userId, action);
      if (result.outcome === "self_change_denied") throw new AppError(409, "Administrators cannot change their own access here", "SELF_CHANGE_DENIED");
      if (result.outcome === "forbidden") throw new AppError(403, "Platform administrator access is required", "FORBIDDEN");
      if (result.outcome === "not_found") throw new AppError(404, "Managed user not found", "USER_NOT_FOUND");
      if (result.outcome !== "updated") throw new AppError(409, "User status transition is invalid", "INVALID_STATUS_TRANSITION");
      await repository.setAuthBan(userId, action === "suspend");
      return { userId, action };
    },
    async removeUser({ actorUserId, userId }) {
      const result = await repository.transitionUser(actorUserId, userId, "remove");
      if (result.outcome === "self_change_denied") throw new AppError(409, "Administrators cannot remove themselves", "SELF_DELETE_DENIED");
      if (result.outcome === "forbidden") throw new AppError(403, "Platform administrator access is required", "FORBIDDEN");
      if (result.outcome === "not_found") throw new AppError(404, "User not found", "USER_NOT_FOUND");
      if (result.outcome !== "updated") throw new AppError(409, "User removal is invalid", "INVALID_STATUS_TRANSITION");
      await repository.setAuthBan(userId, true);
    },
    listAuditLogs() { return repository.listAuditLogs(); },
  };
}

export const platformService = createPlatformService();
