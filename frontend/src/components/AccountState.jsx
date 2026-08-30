import { AuthBrand, AuthPageLayout } from "./AuthPageLayout";

const copy = {
  pending_email: ["Confirm your email", "Open the confirmation email from Supabase, then sign in again."],
  pending_approval: ["Approval pending", "Your lounge was created and is waiting for platform administrator approval."],
  rejected: ["Registration rejected", "This lounge registration was not approved. Contact the platform administrator if this is unexpected."],
  suspended: ["Account suspended", "Access to this account has been suspended by the platform administrator."],
  disabled: ["Employee access disabled", "Your lounge owner has disabled this membership."],
  deleted: ["Account unavailable", "This account no longer has platform access."],
  no_access: ["No active lounge access", "Ask the lounge owner or platform administrator to restore your access."],
};

export function AccountState({ state, onSignOut, error }) {
  const [title, text] = copy[state] ?? ["Access unavailable", error || "This account is not authorized."];
  return <AuthPageLayout><section className="auth-card auth-card--message"><AuthBrand /><span className="auth-alert">!</span><h1>{title}</h1><p>{error || text}</p>
    {state === "suspended" && <div className="auth-support-note"><strong>Your subscription may have expired.</strong><span>Contact our support team to review your account and restore access.</span></div>}
    <div className="auth-account-actions">
      {state === "suspended" && <a className="public-button public-button--primary public-button--large" href="/contact">Contact support</a>}
      <button className={`public-button public-button--large auth-submit${state === "suspended" ? " public-button--secondary" : " public-button--primary"}`} type="button" onClick={onSignOut}>Sign out</button>
    </div>
  </section></AuthPageLayout>;
}
