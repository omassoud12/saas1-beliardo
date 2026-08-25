const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateInvitation(request) {
  const email = request.body?.email?.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? "") && email.length <= 254
    ? { success: true, data: { email } }
    : { success: false, errors: ["email must be valid"] };
}
export function validateInvitationId(request) {
  return uuidPattern.test(request.params.invitationId ?? "")
    ? { success: true, data: { invitationId: request.params.invitationId } }
    : { success: false, errors: ["invitationId must be a UUID"] };
}
export function validateAcceptInvitation(request) {
  const token = request.body?.token;
  return typeof token === "string" && token.length >= 32 && token.length <= 512
    ? { success: true, data: { token } }
    : { success: false, errors: ["token is invalid"] };
}
export function validateEmployeeStatus(request) {
  const userId = request.params.userId;
  const action = request.body?.action;
  const allowed = ["disable", "reactivate", "remove"];
  const errors = [];
  if (!uuidPattern.test(userId ?? "")) errors.push("userId must be a UUID");
  if (!allowed.includes(action)) errors.push(`action must be one of: ${allowed.join(", ")}`);
  return errors.length ? { success: false, errors } : { success: true, data: { userId, action } };
}
