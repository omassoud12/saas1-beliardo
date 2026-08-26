import { sendSuccess } from "../../shared/utils/response.js";
import { completePasswordSetup, getAccessState } from "./access.service.js";

export function getMyAccess(request, response) {
  return sendSuccess(response, { data: { access: getAccessState(request.auth) } });
}

export async function markPasswordConfigured(request, response, next) {
  try {
    await completePasswordSetup(request.auth.user.id);
    return sendSuccess(response, { message: "Password setup completed" });
  } catch (error) {
    return next(error);
  }
}
