import { useEffect, useState } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import { supabase } from "../lib/supabase";
import { getAuthErrorMessage } from "../utils/authErrors";
import { getPendingInvitation } from "../lib/authLinkState";
import {
  clearPendingEmail, emailConfirmationRedirectUrl, getPendingEmail, meetsPasswordRequirements, rememberPendingEmail, resendSignupConfirmation,
} from "../lib/authOnboarding";
import { AUTH_ROUTES, isEmailConfirmationError, isEmailConfirmed, resolveSignupRoute } from "../lib/authRouting";
import { AuthBrand, AuthPageLayout } from "./AuthPageLayout";
import { CheckEmail } from "./CheckEmail";

const emptyStatus = { pending: false, action: "", error: "", message: "" };

export function AuthGate({ children, initialMode = "signin", path = AUTH_ROUTES.login, authCallback = false, navigate, onModeChange }) {
  const { session, loading } = useAuthSession();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ email: getPendingEmail(), password: "", confirmPassword: "", businessName: "" });
  const [status, setStatus] = useState(emptyStatus);
  const [resendCooldown, setResendCooldown] = useState(0);
  const hasInvitation = Boolean(getPendingInvitation());

  useEffect(() => setMode(initialMode), [initialMode]);
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown > 0]);
  useEffect(() => {
    if (!loading && !session && [AUTH_ROUTES.pendingApproval, AUTH_ROUTES.app].includes(path)) navigate?.(AUTH_ROUTES.login);
  }, [loading, navigate, path, session]);
  useEffect(() => {
    if (!loading && session && !isEmailConfirmed(session.user) && path !== AUTH_ROUTES.checkEmail) navigate?.(AUTH_ROUTES.checkEmail);
  }, [loading, navigate, path, session]);

  if (!supabase) {
    return <AuthMessage title="Supabase configuration required" text="Add the public Supabase URL and anonymous key to frontend/.env, then restart the app." />;
  }
  if (loading || (authCallback && !session)) {
    if (!loading && authCallback) return <AuthMessage title="Confirmation link could not be completed" text="The link may have expired or already been used. Return to sign in or request another confirmation email." action={<a className="public-button public-button--primary public-button--large" href={AUTH_ROUTES.login}>Return to sign in</a>} />;
    return <AuthPageLayout><div className="auth-loading" aria-label={authCallback ? "Completing email confirmation" : "Checking authentication"}><span /></div></AuthPageLayout>;
  }
  const submit = async (event) => {
    event.preventDefault();
    if (mode === "signup" && !meetsPasswordRequirements(form.password)) {
      setStatus({ pending: false, action: "", error: "Use at least 8 characters with letters, numbers, and a symbol.", message: "" });
      return;
    }
    if (mode === "signup" && form.password !== form.confirmPassword) {
      setStatus({ pending: false, action: "", error: "Passwords do not match. Please enter the same password in both fields.", message: "" });
      return;
    }
    setStatus({ pending: true, action: mode, error: "", message: "" });
    const email = form.email.trim().toLowerCase();
    try {
      const credentials = { email, password: form.password };
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp({
          ...credentials,
          options: {
            emailRedirectTo: emailConfirmationRedirectUrl(),
            data: hasInvitation ? { registration_type: "employee" } : { registration_type: "owner", business_name: form.businessName.trim() || "My Lounge" },
          },
        });
      if (result.error) {
        if (isEmailConfirmationError(result.error)) {
          rememberPendingEmail(email);
          setStatus(emptyStatus);
          navigate?.(AUTH_ROUTES.checkEmail);
          return;
        }
        setStatus({ pending: false, action: "", error: getAuthErrorMessage(result.error, mode), message: "" });
        return;
      }
      rememberPendingEmail(email);
      setStatus(emptyStatus);
      navigate?.(mode === "signup" ? resolveSignupRoute(result.data.session) : AUTH_ROUTES.app);
    } catch (error) {
      setStatus({ pending: false, action: "", error: getAuthErrorMessage(error, mode), message: "" });
    }
  };

  const sendPasswordReset = async () => {
    const email = form.email.trim();
    if (!email) {
      setStatus({ pending: false, action: "", error: "Enter your email address first.", message: "" });
      return;
    }
    setStatus({ pending: true, action: "reset", error: "", message: "" });
    const redirectTo = `${window.location.origin}/?reset_password=1`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setStatus(error
      ? { pending: false, action: "", error: getAuthErrorMessage(error), message: "" }
      : { pending: false, action: "", error: "", message: "If the account exists, a password reset link was sent." });
  };

  const resendConfirmation = async () => {
    const email = form.email.trim() || getPendingEmail() || session?.user?.email || "";
    if (!email) {
      setStatus({ pending: false, action: "", error: "Return to sign up or sign in and enter your email address first.", message: "" });
      return;
    }
    setStatus({ pending: true, action: "resend", error: "", message: "" });
    try {
      const { error } = await resendSignupConfirmation(supabase.auth, { email, redirectTo: emailConfirmationRedirectUrl() });
      if (error) throw error;
      setResendCooldown(30);
      setStatus({ pending: false, action: "", error: "", message: "Confirmation email sent again." });
    } catch (error) {
      setStatus({ pending: false, action: "", error: getAuthErrorMessage(error, "signup"), message: "" });
    }
  };

  const signOut = async () => {
    clearPendingEmail();
    await supabase.auth.signOut();
    navigate?.(AUTH_ROUTES.login);
  };

  if (session && isEmailConfirmed(session.user)) return children({ session, signOut });

  if ((session && !isEmailConfirmed(session.user)) || path === AUTH_ROUTES.checkEmail) {
    return <CheckEmail email={form.email || getPendingEmail() || session?.user?.email || ""} status={status} resendCooldown={resendCooldown} onResend={resendConfirmation} onSignIn={session ? signOut : () => { setStatus(emptyStatus); navigate?.(AUTH_ROUTES.login); }} />;
  }

  return (
    <AuthPageLayout>
      <section className={`auth-card auth-card--form auth-card--${mode}`} aria-labelledby="auth-title">
        <AuthBrand />
        <p className="eyebrow">Lounge management</p>
        <h1 id="auth-title">{mode === "signin" ? "Welcome back" : hasInvitation ? "Join your lounge" : "Create your lounge"}</h1>
        <p>{mode === "signin" ? "Sign in to manage live sessions and business performance." : hasInvitation ? "Create the employee account that matches your invitation email." : "Set up a secure owner account for your lounge."}</p>
        <form onSubmit={submit}>
          {mode === "signup" && !hasInvitation && (
            <label><span>Lounge name</span><input type="text" value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} autoComplete="organization" maxLength="80" /></label>
          )}
          <label><span>Email</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" /></label>
          <PasswordField label="Password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder={mode === "signup" ? "8+ characters, letters, numbers & symbol" : "Enter your password"} hint={mode === "signup" ? "Use at least 8 characters with letters, numbers, and a symbol." : ""} />
          {mode === "signup" && <PasswordField label="Confirm password" value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} autoComplete="new-password" placeholder="Repeat your password" />}
          {status.error && <p className="auth-feedback auth-feedback--error" role="alert">{status.error}</p>}
          {status.message && <p className="auth-feedback" role="status">{status.message}</p>}
          <button className="public-button public-button--primary public-button--large auth-submit" type="submit" disabled={status.pending}>{status.pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        {mode === "signin" && <button className="auth-secondary-action" type="button" disabled={status.pending} onClick={sendPasswordReset}>Forgot password?</button>}
        <button className="auth-mode-switch" type="button" disabled={status.pending} onClick={() => { const nextMode = mode === "signin" ? "signup" : "signin"; setMode(nextMode); onModeChange?.(nextMode); setStatus(emptyStatus); }}>
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </AuthPageLayout>
  );
}

function AuthMessage({ title, text, action }) {
  return <AuthPageLayout><section className="auth-card auth-card--message"><AuthBrand /><span className="auth-alert">!</span><h1>{title}</h1><p>{text}</p>{action && <div className="auth-account-actions">{action}</div>}</section></AuthPageLayout>;
}

function PasswordField({ label, value, onChange, autoComplete, placeholder, hint = "" }) {
  const [visible, setVisible] = useState(false);
  return <label><span>{label}</span><span className="auth-password-field">
    <input type={visible ? "text" : "password"} required minLength="8" value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} />
    <button type="button" className="auth-password-toggle" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  </span>{hint && <small className="auth-password-hint">{hint}</small>}</label>;
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.75" /></svg>;
}

function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.1 2.8M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.7-.3 3.8-.8M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>;
}
