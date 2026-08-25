import { useState } from "react";
import { supabase } from "../lib/supabase";

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
    const { error } = await supabase.auth.updateUser({ password: form.password });
    if (error) setStatus({ pending: false, error: error.message });
    else onComplete();
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="password-title">
        <div className="auth-brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <p className="eyebrow">Secure account</p>
        <h1 id="password-title">{reason === "invite" ? "Set your password" : "Choose a new password"}</h1>
        <p>{reason === "invite" ? "Create a password for future employee sign-ins." : "Use this password the next time you sign in."}</p>
        <form onSubmit={submit}>
          <label><span>New password</span><input type="password" required minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></label>
          <label><span>Confirm password</span><input type="password" required minLength="8" value={form.confirmation} onChange={(event) => setForm({ ...form, confirmation: event.target.value })} autoComplete="new-password" /></label>
          {status.error && <p className="auth-feedback auth-feedback--error" role="alert">{status.error}</p>}
          <button className="button button--primary button--wide" type="submit" disabled={status.pending}>{status.pending ? "Saving…" : "Save password"}</button>
        </form>
        <button className="auth-mode-switch" type="button" onClick={onSignOut}>Cancel and sign out</button>
      </section>
    </main>
  );
}
