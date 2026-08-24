import { sendSuccess } from "../../shared/utils/response.js";
import { sessionService } from "./session.service.js";

export async function createSession(request, response, next) {
  try {
    const session = await sessionService.create({
      businessId: request.auth.businessId,
      userId: request.auth.user.id,
      ...request.validated,
    });
    return sendSuccess(response, { statusCode: 201, data: { session }, message: "Session created" });
  } catch (error) { return next(error); }
}

export async function getSession(request, response, next) {
  try {
    const session = await sessionService.getById({ businessId: request.auth.businessId, ...request.validated });
    return sendSuccess(response, { data: { session } });
  } catch (error) { return next(error); }
}

export async function getActiveSessions(request, response, next) {
  try {
    const sessions = await sessionService.getActive({ businessId: request.auth.businessId });
    return sendSuccess(response, { data: { sessions } });
  } catch (error) { return next(error); }
}

export async function getCompletedSessions(request, response, next) {
  try {
    const sessions = await sessionService.getCompleted({ businessId: request.auth.businessId, filters: request.validated });
    return sendSuccess(response, { data: { sessions } });
  } catch (error) { return next(error); }
}

function action(method, message) {
  return async (request, response, next) => {
    try {
      const session = await sessionService[method]({ businessId: request.auth.businessId, ...request.validated });
      return sendSuccess(response, { data: { session }, message });
    } catch (error) { return next(error); }
  };
}

export const startSession = action("start", "Session started");
export const pauseSession = action("pause", "Session paused");
export const resumeSession = action("resume", "Session resumed");
export const updateSession = action("update", "Session updated");
export const endSession = action("end", "Session ended");

export async function deleteSession(request, response, next) {
  try {
    await sessionService.remove({ businessId: request.auth.businessId, ...request.validated });
    return sendSuccess(response, { data: {}, message: "Session deleted" });
  } catch (error) { return next(error); }
}
