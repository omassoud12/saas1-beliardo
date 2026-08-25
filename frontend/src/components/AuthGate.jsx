import { useState } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import { supabase } from "../lib/supabase";

export function AuthGate({ children }) {
  const { session, loading } = useAuthSession();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ email: "", password: "", businessName: "" });
  const [status, setStatus] = useState({ pending: false, error: "", message: "" });
  const hasInvitation = new URLSearchParams(window.location.search).has("invite");

  if (!supabase) {
    return <AuthMessage title="Supabase configuration required" text="Add the public Supabase URL and anonymous key to frontend/.env, then restart the app." />;
  }
  if (loading) return <div className="auth-loading" aria-label="Checking authentication"><span /></div>;
  if (session) return children({ session, signOut: () => supabase.auth.signOut() });

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ pending: true, error: "", message: "" });
    try {
      const credentials = { email: form.email.trim(), password: form.password };
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp({
          ...credentials,
          options: { data: hasInvitation ? { registration_type: "employee" } : { registration_type: "owner", business_name: form.businessName.trim() || "My Lounge" } },
        });
      if (result.error) {
        setStatus({ pending: false, error: result.error.message, message: "" });
      } else if (mode === "signup" && !result.data.session) {
        setStatus({ pending: false, error: "", message: "Check your email to confirm the account, then sign in." });
      }
    } catch {
      setStatus({ pending: false, error: "Unable to reach the authentication service. Try again.", message: "" });
    }
  };

  const sendPasswordReset = async () => {
    const email = form.email.trim();
    if (!email) {
      setStatus({ pending: false, error: "Enter your email address first.", message: "" });
      return;
    }
    setStatus({ pending: true, error: "", message: "" });
    const redirectTo = `${window.location.origin}${window.location.pathname}?reset_password=1`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setStatus(error
      ? { pending: false, error: error.message, message: "" }
      : { pending: false, error: "", message: "If the account exists, a password reset link was sent." });
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <p className="eyebrow">Lounge management</p>
        <h1 id="auth-title">{mode === "signin" ? "Welcome back" : hasInvitation ? "Join your lounge" : "Create your lounge"}</h1>
        <p>{mode === "signin" ? "Sign in to manage live sessions and business performance." : hasInvitation ? "Create the employee account that matches your invitation email." : "Set up a secure owner account for your lounge."}</p>
        <form onSubmit={submit}>
          {mode === "signup" && !hasInvitation && (
            <label><span>Lounge name</span><input type="text" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} autoComplete="organization" maxLength="80" /></label>
          )}
          <label><span>Email</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label>
          <label><span>Password</span><input type="password" required minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>
          {status.error && <p className="auth-feedback auth-feedback--error" role="alert">{status.error}</p>}
          {status.message && <p className="auth-feedback" role="status">{status.message}</p>}
          <button className="button button--primary button--wide" type="submit" disabled={status.pending}>{status.pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        {mode === "signin" && <button className="auth-secondary-action" type="button" disabled={status.pending} onClick={sendPasswordReset}>Forgot password?</button>}
        <button className="auth-mode-switch" type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setStatus({ pending: false, error: "", message: "" }); }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

function AuthMessage({ title, text }) {
  return <main className="auth-page"><section className="auth-card auth-card--message"><span className="auth-alert">!</span><h1>{title}</h1><p>{text}</p></section></main>;
}
