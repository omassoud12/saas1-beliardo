import test from "node:test";
import assert from "node:assert/strict";
import { getAuthErrorMessage } from "../src/utils/authErrors.js";

test("authentication errors explain invalid credentials and unconfirmed email", () => {
  assert.match(getAuthErrorMessage({ code: "invalid_credentials" }), /Forgot password/);
  assert.match(getAuthErrorMessage({ code: "email_not_confirmed" }), /Confirm your email/);
});

test("authentication errors preserve useful provider messages and have safe fallbacks", () => {
  assert.equal(getAuthErrorMessage({ message: "Provider-specific problem" }), "Provider-specific problem");
  assert.match(getAuthErrorMessage(null, "signup"), /create the account/);
});
