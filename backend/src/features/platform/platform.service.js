import { AppError } from "../../shared/errors/AppError.js";
import { platformRepository } from "./platform.repository.js";

const transition = {
  approve: { profile: "approved", business: "approved", membership: "active" },
  reject: { profile: "rejected", business: "rejected", membership: "disabled" },
  suspend: { profile: "suspended", business: "suspended", membership: "disabled" },
  reactivate: { profile: "approved", business: "approved", membership: "active" },
};

export function createPlatformService({ repository = platformRepository } = {}) {
  async function requireManagedOwner(userId) {
    const [profile, membership] = await Promise.all([repository.findProfile(userId), repository.findOwnerMembership(userId)]);
    if (!profile || profile.account_type !== "owner" || !membership) throw new AppError(404, "Owner account not found", "OWNER_NOT_FOUND");
    return { profile, membership };
  }

  async function changeOwnerStatus({ actorUserId, userId, action }) {
    if (actorUserId === userId) throw new AppError(409, "Administrators cannot change their own access here", "SELF_CHANGE_DENIED");
    const { membership } = await requireManagedOwner(userId);
    const next = transition[action];
    await repository.updateProfile(userId, { account_status: next.profile });
    await repository.updateBusiness(membership.business_id, { status: next.business });
    await repository.updateMembership(userId, membership.business_id, { status: next.membership });
    await repository.audit({ actor_user_id: actorUserId, target_user_id: userId, business_id: membership.business_id, action: `owner.${action}` });
    return { userId, action, status: next.profile };
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
      const profile = await repository.findProfile(userId);
      if (!profile || profile.account_status === "deleted") throw new AppError(404, "User not found", "USER_NOT_FOUND");
      const updated = await repository.updateProfile(userId, { full_name: fullName });
      await repository.audit({ actor_user_id: actorUserId, target_user_id: userId, action: "user.update", metadata: { fields: ["full_name"] } });
      return { id: updated.id, fullName: updated.full_name };
    },
    async changeUserStatus({ actorUserId, userId, action }) {
      if (actorUserId === userId) throw new AppError(409, "Administrators cannot change their own access here", "SELF_CHANGE_DENIED");
      const profile = await repository.findProfile(userId);
      if (!profile || profile.account_type === "platform_admin") throw new AppError(404, "Managed user not found", "USER_NOT_FOUND");
      if (profile.account_type === "owner") return changeOwnerStatus({ actorUserId, userId, action });
      const membership = await repository.findMembership(userId);
      await repository.updateProfile(userId, { account_status: action === "suspend" ? "suspended" : "approved" });
      if (membership) await repository.updateMembership(userId, membership.business_id, { status: action === "suspend" ? "disabled" : "active" });
      await repository.audit({ actor_user_id: actorUserId, target_user_id: userId, business_id: membership?.business_id, action: `user.${action}` });
      return { userId, action };
    },
    async removeUser({ actorUserId, userId }) {
      if (actorUserId === userId) throw new AppError(409, "Administrators cannot remove themselves", "SELF_DELETE_DENIED");
      const profile = await repository.findProfile(userId);
      if (!profile) throw new AppError(404, "User not found", "USER_NOT_FOUND");
      const membership = await repository.findMembership(userId);
      await repository.updateProfile(userId, { account_status: "deleted" });
      if (membership) {
        await repository.updateMembership(userId, membership.business_id, { status: "removed" });
        if (membership.role === "owner") await repository.updateBusiness(membership.business_id, { status: "deleted" });
      }
      await repository.audit({ actor_user_id: actorUserId, target_user_id: userId, business_id: membership?.business_id, action: "user.remove" });
    },
    listAuditLogs() { return repository.listAuditLogs(); },
  };
}

export const platformService = createPlatformService();
