import { AuthBrand, AuthPageLayout } from "./AuthPageLayout";

export function CheckEmail({ email, status, resendCooldown, onResend, onSignIn }) {
  const resendDisabled = status.pending || resendCooldown > 0 || !email;
  return <AuthPageLayout><section className="auth-card auth-card--message" aria-labelledby="check-email-title">
    <AuthBrand />
    <span className="auth-status-icon" aria-hidden="true">@</span>
    <p className="eyebrow">Email confirmation</p>
    <h1 id="check-email-title">Check your email</h1>
    <p>We sent a confirmation link{email ? <> to <strong className="auth-email">{email}</strong></> : " to your email address"}. Open it to confirm your account and continue.</p>
    <p className="auth-support-copy">Didn&apos;t receive the email? Check your Spam or Junk folder, or resend it.</p>
    {status.error && <p className="auth-feedback auth-feedback--error" role="alert">{status.error}</p>}
    {status.message && <p className="auth-feedback" role="status">{status.message}</p>}
    <div className="auth-account-actions">
      <button className="public-button public-button--primary public-button--large" type="button" disabled={resendDisabled} onClick={onResend}>{status.action === "resend" && status.pending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}</button>
      <button className="auth-secondary-action auth-secondary-action--center" type="button" disabled={status.pending} onClick={onSignIn}>Back to sign in</button>
    </div>
  </section></AuthPageLayout>;
}
