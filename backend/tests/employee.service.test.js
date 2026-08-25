import test from "node:test";
import assert from "node:assert/strict";
import { createEmployeeService } from "../src/features/employees/employee.service.js";

function repository(overrides = {}) {
  return {
    async findPendingInvitation() { return null; },
    async insertInvitation(values) { return { id: "invite-1", email: values.email, status: "pending", ...values }; },
    async inviteAuthUser() {}, async sendRecoveryEmail() {}, async revokeInvitation() { return { id: "invite-1" }; }, async audit() {},
    async findInvitation() { return { id: "invite-1", email: "employee@example.com", status: "pending" }; },
    async rotateInvitation(_businessId, _invitationId, values) { return { id: "invite-1", ...values }; },
    async updateMembership() { return { user_id: "employee-1" }; }, async accept() { return { business_id: "business-1" }; },
    async listMemberships() { return []; }, async listProfiles() { return []; }, async listInvitations() { return []; },
    ...overrides,
  };
}
const env = () => ({ frontendUrl: "https://app.example.com" });

test("employee invitation stores only a SHA-256 token hash", async () => {
  let stored; let delivered;
  const service = createEmployeeService({ repository: repository({ async insertInvitation(values) { stored = values; return { id: "invite-1", email: values.email }; }, async inviteAuthUser(_email, redirect) { delivered = new URL(redirect).searchParams.get("invite"); } }), env });
  await service.invite({ businessId: "business-1", actorUserId: "owner-1", email: "employee@example.com" });
  assert.equal(stored.token_hash.length, 64);
  assert.notEqual(stored.token_hash, delivered);
  assert.equal(stored.token_hash.includes(delivered), false);
});

test("duplicate pending employee invitation is rejected", async () => {
  const service = createEmployeeService({ repository: repository({ async findPendingInvitation() { return { id: "existing" }; } }), env });
  await assert.rejects(() => service.invite({ businessId: "b1", actorUserId: "o1", email: "e@example.com" }), { code: "INVITATION_EXISTS" });
});

test("expired invitation database result becomes a safe API error", async () => {
  const service = createEmployeeService({ repository: repository({ async accept() { throw new Error("INVITATION_EXPIRED"); } }), env });
  await assert.rejects(() => service.accept({ token: "x".repeat(40), userId: "u1", email: "e@example.com" }), { statusCode: 410, code: "INVITATION_EXPIRED" });
});

test("already-used invitation cannot be accepted again", async () => {
  const service = createEmployeeService({ repository: repository({ async accept() { throw new Error("INVITATION_ALREADY_USED"); } }), env });
  await assert.rejects(() => service.accept({ token: "x".repeat(40), userId: "u1", email: "e@example.com" }), { code: "INVITATION_ALREADY_USED" });
});

test("owner employee changes stay scoped to the authenticated business", async () => {
  let scopedBusiness;
  const service = createEmployeeService({ repository: repository({ async updateMembership(businessId) { scopedBusiness = businessId; return { user_id: "u1" }; } }), env });
  await service.changeStatus({ businessId: "business-owner", actorUserId: "owner-1", userId: "employee-1", action: "disable" });
  assert.equal(scopedBusiness, "business-owner");
});

test("existing Auth user receives a recovery-based invitation link", async () => {
  let recoveryRedirect;
  const service = createEmployeeService({ repository: repository({
    async inviteAuthUser() { throw new Error("User already registered"); },
    async sendRecoveryEmail(_email, redirect) { recoveryRedirect = redirect; },
  }), env });
  await service.invite({ businessId: "b1", actorUserId: "o1", email: "existing@example.com" });
  assert.match(recoveryRedirect, /^https:\/\/app\.example\.com\/\?invite=/);
});

test("email provider failures return a specific operational error", async () => {
  const service = createEmployeeService({ repository: repository({ async inviteAuthUser() { throw new Error("Error sending invite email via SMTP"); } }), env });
  await assert.rejects(() => service.invite({ businessId: "b1", actorUserId: "o1", email: "e@example.com" }), { statusCode: 502, code: "INVITATION_DELIVERY_FAILED" });
});
