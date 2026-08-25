const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUserId(request) {
  return uuidPattern.test(request.params.userId ?? "")
    ? { success: true, data: { userId: request.params.userId } }
    : { success: false, errors: ["userId must be a UUID"] };
}

export function validateOwnerStatus(request) {
  const base = validateUserId(request);
  const action = request.body?.action;
  const allowed = ["approve", "reject", "suspend", "reactivate"];
  if (!base.success || !allowed.includes(action)) {
    return { success: false, errors: [...(base.errors ?? []), ...(!allowed.includes(action) ? [`action must be one of: ${allowed.join(", ")}`] : [])] };
  }
  return { success: true, data: { ...base.data, action } };
}

export function validateUserUpdate(request) {
  const base = validateUserId(request);
  const fullName = request.body?.fullName;
  if (!base.success || typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100) {
    return { success: false, errors: [...(base.errors ?? []), "fullName must contain 1 to 100 characters"] };
  }
  return { success: true, data: { ...base.data, fullName: fullName.trim() } };
}

export function validateUserStatus(request) {
  const base = validateUserId(request);
  const action = request.body?.action;
  if (!base.success || !["suspend", "reactivate"].includes(action)) return { success: false, errors: [...(base.errors ?? []), "action must be suspend or reactivate"] };
  return { success: true, data: { ...base.data, action } };
}
