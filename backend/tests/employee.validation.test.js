import test from "node:test";
import assert from "node:assert/strict";
import { validateAcceptInvitation } from "../src/features/employees/employee.validation.js";

test("employee invitation acceptance supports the verified-email fallback", () => {
  assert.deepEqual(validateAcceptInvitation({ body: {} }), { success: true, data: { token: null } });
  assert.deepEqual(validateAcceptInvitation({}), { success: true, data: { token: null } });
});

test("employee invitation acceptance still rejects malformed supplied tokens", () => {
  assert.equal(validateAcceptInvitation({ body: { token: "short" } }).success, false);
  assert.equal(validateAcceptInvitation({ body: { token: "x".repeat(32) } }).success, true);
});
