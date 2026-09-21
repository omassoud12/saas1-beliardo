import { AuthBrand, AuthPageLayout } from "./AuthPageLayout";

const copy = {
  pending_email: ["Confirm your email", "Open the confirmation email from Supabase, then sign in again."],
  pending_approval: ["Approval pending", "Your lounge was created and is waiting for platform administrator approval. Contact us to request approval and activate your account."],
  rejected: ["Registration rejected", "This lounge registration was not approved. Contact the platform administrator if this is unexpected."],
  suspended: ["Account suspended", "Access to this account has been suspended by the platform administrator."],
  disabled: ["Employee access disabled", "Your lounge owner has disabled this membership."],
  deleted: ["Account unavailable", "This account no longer has platform access."],
  no_access: ["No active lounge access", "Ask the lounge owner or platform administrator to restore your access."],
};

export function AccountState({ state, onSignOut, error, onCheckStatus, checking = false, statusMessage = "", checkLabel = "Check Approval Status" }) {
  const [title, text] = copy[state] ?? ["Access unavailable", error || "This account is not authorized."];
  return <AuthPageLayout><section className="auth-card auth-card--message"><AuthBrand /><span className="auth-alert">!</span><h1>{title}</h1><p>{error || text}</p>
    {state === "suspended" && <div className="auth-support-note"><strong>Your subscription may have expired.</strong><span>Contact our support team to review your account and restore access.</span></div>}
    {statusMessage && <div className={`auth-feedback auth-state-feedback${statusMessage.startsWith("We couldn't") ? " auth-feedback--error" : ""}`} role="status">{statusMessage}</div>}
    <div className="auth-account-actions">
      {onCheckStatus && <button className="public-button public-button--primary public-button--large" type="button" disabled={checking} onClick={onCheckStatus}>{checking ? "Checking…" : checkLabel}</button>}
      {["pending_approval", "suspended"].includes(state) && <a className={`public-button public-button--large${state === "suspended" ? " public-button--primary" : " public-button--secondary"}`} href="/contact">{state === "pending_approval" ? "Contact Us" : "Contact support"}</a>}
      <button className="auth-secondary-action auth-secondary-action--center" type="button" disabled={checking} onClick={onSignOut}>Sign out</button>
    </div>
  </section></AuthPageLayout>;
}
