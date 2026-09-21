import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_ROUTES, isEmailConfirmationError, resolvePostAuthRoute, resolveSignupRoute,
} from "../src/lib/authRouting.js";
import { meetsPasswordRequirements, resendSignupConfirmation } from "../src/lib/authOnboarding.js";

const session = (confirmed = true) => ({ user: { id: "user-1", email_confirmed_at: confirmed ? "2026-09-21T10:00:00Z" : null } });

test("signup without a session routes to check-email and never creates a second account", () => {
  assert.equal(resolveSignupRoute(null), AUTH_ROUTES.checkEmail);
  assert.equal(resolveSignupRoute(session()), AUTH_ROUTES.app);
});

test("unconfirmed, confirmed pending, and approved accounts resolve to their authoritative routes", () => {
  assert.equal(resolvePostAuthRoute({ session: null, access: null }), AUTH_ROUTES.login);
  assert.equal(resolvePostAuthRoute({ session: session(false), access: { state: "pending_email" } }), AUTH_ROUTES.checkEmail);
  assert.equal(resolvePostAuthRoute({ session: session(), access: { state: "pending_approval" } }), AUTH_ROUTES.pendingApproval);
  assert.equal(resolvePostAuthRoute({ session: session(), access: { state: "approved_owner" } }), AUTH_ROUTES.app);
});

test("callback and protected-route decisions use the same resolver", () => {
  const pending = resolvePostAuthRoute({ session: session(), access: { state: "pending_approval" } });
  assert.equal(pending, AUTH_ROUTES.pendingApproval);
  assert.equal(resolvePostAuthRoute({ session: session(), access: { state: "approved_owner" } }), AUTH_ROUTES.app);
});

test("failed approval lookup does not redirect and stable destinations do not loop", () => {
  assert.equal(resolvePostAuthRoute({ session: session(), access: null }), null);
  const route = resolvePostAuthRoute({ session: session(), access: { state: "pending_approval" } });
  assert.equal(resolvePostAuthRoute({ session: session(), access: { state: "pending_approval" } }), route);
});

test("email confirmation errors are recognized by provider code or message", () => {
  assert.equal(isEmailConfirmationError({ code: "email_not_confirmed" }), true);
  assert.equal(isEmailConfirmationError({ message: "Email not confirmed" }), true);
  assert.equal(isEmailConfirmationError({ code: "invalid_credentials" }), false);
});

test("resend uses the Supabase signup confirmation method", async () => {
  let request;
  const auth = { resend: async (values) => { request = values; return { error: null }; } };
  await resendSignupConfirmation(auth, { email: " Owner@Example.com ", redirectTo: "https://example.com/app" });
  assert.deepEqual(request, {
    type: "signup",
    email: "owner@example.com",
    options: { emailRedirectTo: "https://example.com/app" },
  });
});

test("signup password requirements need letters, numbers, a symbol, and eight characters", () => {
  assert.equal(meetsPasswordRequirements("Password1!"), true);
  assert.equal(meetsPasswordRequirements("كلمةمرور1!"), true);
  assert.equal(meetsPasswordRequirements("password!"), false);
  assert.equal(meetsPasswordRequirements("Password1"), false);
  assert.equal(meetsPasswordRequirements("Pass1!"), false);
});
