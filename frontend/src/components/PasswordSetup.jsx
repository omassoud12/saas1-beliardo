import { useState } from "react";
import { AuthBrand, AuthPageLayout } from "./AuthPageLayout";

export function PasswordSetup({ onComplete, onSignOut, reason = "invite" }) {
  const [form, setForm] = useState({ password: "", confirmation: "" });
  const [status, setStatus] = useState({ pending: false, error: "" });

  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirmation) {
      setStatus({ pending: false, error: "Passwords do not match." });
      return;
    }
    setStatus({ pending: true, error: "" });
    try {
      await onComplete(form.password);
    } catch (error) {
      setStatus({ pending: false, error: error.message || "Unable to complete password setup." });
    }
  };

  return (
    <AuthPageLayout>
      <section className="auth-card" aria-labelledby="password-title">
        <AuthBrand />
        <p className="eyebrow">Secure account</p>
        <h1 id="password-title">{reason === "invite" ? "Set your password" : "Choose a new password"}</h1>
        <p>{reason === "invite" ? "Create a password for future employee sign-ins." : "Use this password the next time you sign in."}</p>
        <form onSubmit={submit}>
          <label><span>New password</span><input type="password" required minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></label>
          <label><span>Confirm password</span><input type="password" required minLength="8" value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value })} autoComplete="new-password" /></label>
          {status.error && <p className="auth-feedback auth-feedback--error" role="alert">{status.error}</p>}
          <button className="public-button public-button--primary public-button--large auth-submit" type="submit" disabled={status.pending}>{status.pending ? "Saving…" : "Save password"}</button>
        </form>
        <button className="auth-mode-switch" type="button" onClick={onSignOut}>Cancel and sign out</button>
      </section>
    </AuthPageLayout>
  );
}
