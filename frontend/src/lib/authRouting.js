export const AUTH_ROUTES = Object.freeze({
  login: "/login",
  register: "/register",
  checkEmail: "/check-email",
  pendingApproval: "/pending-approval",
  app: "/app",
});

export function isEmailConfirmed(user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

export function resolvePostAuthRoute({ session, access }) {
  if (!session?.user) return AUTH_ROUTES.login;
  if (!isEmailConfirmed(session.user) || access?.state === "pending_email") return AUTH_ROUTES.checkEmail;
  if (!access) return null;
  if (access.state === "pending_approval") return AUTH_ROUTES.pendingApproval;
  return AUTH_ROUTES.app;
}

export function isEmailConfirmationError(error) {
  const code = error?.code ?? error?.error_code;
  return code === "email_not_confirmed" || /email\s+not\s+confirmed/i.test(error?.message ?? "");
}

export function resolveSignupRoute(session) {
  return session ? AUTH_ROUTES.app : AUTH_ROUTES.checkEmail;
}
