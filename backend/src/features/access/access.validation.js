export function validatePasswordUpdate(request) {
  const password = request.body?.password;
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { success: false, errors: ["password must contain 8 to 128 characters"] };
  }
  return { success: true, data: { password } };
}
