const invitationKey = "auth.pending-invitation";
const resetKey = "auth.pending-password-reset";

export function captureAuthLinkState() {
  const params = new URLSearchParams(window.location.search);
  const invitation = params.get("invite");
  if (invitation) {
    window.sessionStorage.setItem(invitationKey, invitation);
    params.delete("invite");
  }
  if (params.get("reset_password") === "1") {
    window.sessionStorage.setItem(resetKey, "1");
    params.delete("reset_password");
  }
  if (invitation || window.sessionStorage.getItem(resetKey)) {
    window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
  }
}

export const getPendingInvitation = () => window.sessionStorage.getItem(invitationKey);
export const clearPendingInvitation = () => window.sessionStorage.removeItem(invitationKey);
export const hasPendingPasswordReset = () => window.sessionStorage.getItem(resetKey) === "1";
export const clearPendingPasswordReset = () => window.sessionStorage.removeItem(resetKey);
