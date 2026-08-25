import test from "node:test";
import assert from "node:assert/strict";
import { createPlatformService } from "../src/features/platform/platform.service.js";

function repository(overrides = {}) {
  return {
    async findProfile(id) { return { id, account_type: "owner", account_status: "pending_approval" }; },
    async findOwnerMembership(userId) { return { user_id: userId, business_id: "business-1", role: "owner", status: "active" }; },
    async findMembership(userId) { return { user_id: userId, business_id: "business-1", role: "owner", status: "active" }; },
    async updateProfile() {}, async updateBusiness() {}, async updateMembership() {}, async audit() {},
    async listManagedProfiles() { return []; }, async listMemberships() { return []; }, async listBusinesses() { return []; },
    ...overrides,
  };
}

test("approving an owner activates profile, tenant, and membership", async () => {
  const writes = [];
  const service = createPlatformService({ repository: repository({ async updateProfile(_id, values) { writes.push(["profile", values.account_status]); }, async updateBusiness(_id, values) { writes.push(["business", values.status]); }, async updateMembership(_id, _business, values) { writes.push(["membership", values.status]); } }) });
  await service.changeOwnerStatus({ actorUserId: "admin-1", userId: "owner-1", action: "approve" });
  assert.deepEqual(writes, [["profile", "approved"], ["business", "approved"], ["membership", "active"]]);
});

test("platform administrator cannot suspend itself through managed-user API", async () => {
  const service = createPlatformService({ repository: repository() });
  await assert.rejects(() => service.changeUserStatus({ actorUserId: "admin-1", userId: "admin-1", action: "suspend" }), { code: "SELF_CHANGE_DENIED" });
});

test("employee suspension disables both profile and tenant membership", async () => {
  const writes = [];
  const service = createPlatformService({ repository: repository({ async findProfile(id) { return { id, account_type: "employee", account_status: "approved" }; }, async findMembership(id) { return { user_id: id, business_id: "business-2", role: "employee" }; }, async updateProfile(_id, values) { writes.push(values.account_status); }, async updateMembership(_id, _business, values) { writes.push(values.status); } }) });
  await service.changeUserStatus({ actorUserId: "admin-1", userId: "employee-1", action: "suspend" });
  assert.deepEqual(writes, ["suspended", "disabled"]);
});
