import test from "node:test";
import assert from "node:assert/strict";
import { createPlatformService } from "../src/features/platform/platform.service.js";

function repository(overrides = {}) {
  return {
    async findProfile(id) { return { id, account_type: "owner", account_status: "pending_approval" }; },
    async findOwnerMembership(userId) { return { user_id: userId, business_id: "business-1", role: "owner", status: "active" }; },
    async findMembership(userId) { return { user_id: userId, business_id: "business-1", role: "owner", status: "active" }; },
    async updateProfile() {}, async updateBusiness() {}, async updateMembership() {}, async audit() {},
    async transitionUser(actorUserId, userId, action) {
      if (actorUserId === userId) return { outcome: "self_change_denied" };
      return { outcome: "updated", account_status: action === "approve" ? "approved" : action === "suspend" ? "suspended" : "approved" };
    },
    async setAuthBan() {},
    async listManagedProfiles() { return []; }, async listMemberships() { return []; }, async listBusinesses() { return []; },
    ...overrides,
  };
}

test("approving an owner uses one atomic transition", async () => {
  const writes = [];
  const service = createPlatformService({ repository: repository({ async transitionUser(actor, user, action) { writes.push([actor, user, action]); return { outcome: "updated", account_status: "approved" }; } }) });
  await service.changeOwnerStatus({ actorUserId: "admin-1", userId: "owner-1", action: "approve" });
  assert.deepEqual(writes, [["admin-1", "owner-1", "approve"]]);
});

test("platform administrator cannot suspend itself through managed-user API", async () => {
  const service = createPlatformService({ repository: repository() });
  await assert.rejects(() => service.changeUserStatus({ actorUserId: "admin-1", userId: "admin-1", action: "suspend" }), { code: "SELF_CHANGE_DENIED" });
});

test("employee suspension disables both profile and tenant membership", async () => {
  const writes = [];
  const service = createPlatformService({ repository: repository({ async transitionUser(actor, user, action) { writes.push([actor, user, action]); return { outcome: "updated", account_status: "suspended" }; } }) });
  await service.changeUserStatus({ actorUserId: "admin-1", userId: "employee-1", action: "suspend" });
  assert.deepEqual(writes, [["admin-1", "employee-1", "suspend"]]);
});
