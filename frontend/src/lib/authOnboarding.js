const pendingEmailKey = "auth.pending-email";

export function meetsPasswordRequirements(password) {
  return password.length >= 8 && /\p{L}/u.test(password) && /\p{N}/u.test(password) && /[^\p{L}\p{N}\s]/u.test(password);
}

export function rememberPendingEmail(email) {
  const normalized = email?.trim().toLowerCase();
  if (normalized) window.sessionStorage.setItem(pendingEmailKey, normalized);
}

export function getPendingEmail() {
  return window.sessionStorage.getItem(pendingEmailKey) ?? "";
}

export function clearPendingEmail() {
  window.sessionStorage.removeItem(pendingEmailKey);
}

export function emailConfirmationRedirectUrl() {
  return window.location.origin;
}

export async function resendSignupConfirmation(auth, { email, redirectTo }) {
  return auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: redirectTo },
  });
}
