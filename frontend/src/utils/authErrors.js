const messages = {
  invalid_credentials: "The email or password is incorrect. If you are unsure of the password, use Forgot password.",
  email_not_confirmed: "Confirm your email address using the link Supabase sent, then sign in again.",
  user_banned: "This account is currently suspended. Contact the lounge administrator.",
  over_request_rate_limit: "Too many sign-in attempts. Wait a few minutes before trying again.",
  over_email_send_rate_limit: "Too many authentication emails were requested. Wait before requesting another email.",
  captcha_failed: "Authentication verification failed. Refresh the page and try again.",
  email_provider_disabled: "Email and password authentication is disabled for this project.",
};

export function getAuthErrorMessage(error, mode = "signin") {
  const code = error?.code ?? error?.error_code;
  if (messages[code]) return messages[code];
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  return mode === "signin"
    ? "Unable to sign in. Check your connection and try again."
    : "Unable to create the account. Check your connection and try again.";
}
