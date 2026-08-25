import { sendSuccess } from "../../shared/utils/response.js";
import { getAccessState } from "./access.service.js";

export function getMyAccess(request, response) {
  return sendSuccess(response, { data: { access: getAccessState(request.auth) } });
}
