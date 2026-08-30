import { sendSuccess } from "../../shared/utils/response.js";
import { completePasswordSetup, getAccessState } from "./access.service.js";
import { getRequestAccessToken } from "../../middleware/requestContext.js";

export function getMyAccess(request, response) {
  return sendSuccess(response, { data: { access: getAccessState(request.auth) } });
}

export async function updatePassword(request, response, next) {
  try {
    await completePasswordSetup({
      userId: request.auth.user.id,
      accessToken: getRequestAccessToken(),
      password: request.validated.password,
    });
    return sendSuccess(response, { message: "Password setup completed" });
  } catch (error) {
    return next(error);
  }
}
