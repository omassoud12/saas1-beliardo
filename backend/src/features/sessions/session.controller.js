import { sendSuccess } from "../../shared/utils/response.js";
import { getBusinessDateKey, getPeriodRange } from "../../shared/utils/timeRange.js";
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
    const now = new Date();
    const businessDate = getBusinessDateKey(now, request.auth.timezone);
    const nextBusinessDayAt = getPeriodRange("today", request.auth.timezone, now).to;
    const [sessions, finishedToday] = await Promise.all([
      sessionService.getActive({ businessId: request.auth.businessId }),
      sessionService.getFinishedToday({
        businessId: request.auth.businessId,
        timezone: request.auth.timezone,
        at: now,
      }),
    ]);
    return sendSuccess(response, { data: { sessions, finishedToday, businessDate, nextBusinessDayAt } });
  } catch (error) { return next(error); }
}

export async function getCompletedSessions(request, response, next) {
  try {
    const sessions = await sessionService.getCompleted({
      businessId: request.auth.businessId,
      timezone: request.auth.timezone,
      filters: request.validated,
    });
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

export async function endSession(request, response, next) {
  try {
    const session = await sessionService.end({
      businessId: request.auth.businessId,
      userId: request.auth.user.id,
      ...request.validated,
    });
    return sendSuccess(response, { data: { session }, message: "Session ended" });
  } catch (error) { return next(error); }
}

export async function cancelSession(request, response, next) {
  try {
    const session = await sessionService.cancel({
      businessId: request.auth.businessId,
      userId: request.auth.user.id,
      ...request.validated,
    });
    return sendSuccess(response, { data: { session }, message: "Session cancelled" });
  } catch (error) { return next(error); }
}

export async function deleteSession(request, response, next) {
  try {
    await sessionService.remove({ businessId: request.auth.businessId, userId: request.auth.user.id, role: request.auth.role, ...request.validated });
    return sendSuccess(response, { data: {}, message: "Session deleted" });
  } catch (error) { return next(error); }
}
