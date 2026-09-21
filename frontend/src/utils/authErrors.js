const messages = {
  invalid_credentials: "The email or password is incorrect. If you are unsure of the password, use Forgot password.",
  email_not_confirmed: "Confirm your email address using the link Supabase sent, then sign in again.",
  user_banned: "This account is not currently available. Contact support if you believe this is unexpected.",
  over_request_rate_limit: "Too many sign-in attempts. Wait a few minutes before trying again.",
  over_email_send_rate_limit: "Too many authentication emails were requested. Wait before requesting another email.",
  captcha_failed: "Authentication verification failed. Refresh the page and try again.",
  email_provider_disabled: "Email and password authentication is disabled for this project.",
  user_already_exists: "An account already exists for this email. Sign in or reset your password instead.",
  signup_disabled: "New account registration is currently unavailable. Please contact support.",
  weak_password: "Choose a stronger password with at least 8 characters.",
};

export function getAuthErrorMessage(error, mode = "signin") {
  const code = error?.code ?? error?.error_code;
  if (messages[code]) return messages[code];
  if (/email\s+not\s+confirmed/i.test(error?.message ?? "")) return messages.email_not_confirmed;
  if (/fetch|network|connection|timeout/i.test(error?.message ?? "")) return "We couldn't reach the authentication service. Check your connection and try again.";
  return mode === "signin"
    ? "Unable to sign in. Check your connection and try again."
    : "Unable to create the account. Check your connection and try again.";
}
