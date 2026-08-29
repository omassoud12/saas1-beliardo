import { stationRepository } from "../stations/station.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { SESSION_STATUS } from "../../shared/constants/session.js";
import { getPeriodRange, normalizeBusinessRange } from "../../shared/utils/timeRange.js";
import { sessionRepository } from "./session.repository.js";

function elapsedSeconds(session, at) {
  if (!session.startedAt) return 0;
  const endpoint = session.status === SESSION_STATUS.PAUSED
    ? new Date(session.pausedAt)
    : at;
  return Math.max(0, Math.floor(
    (endpoint.getTime() - new Date(session.startedAt).getTime()) / 1000
      - session.totalPausedSeconds,
  ));
}

function currentCost(session, seconds) {
  const controllerCount = Number(session.controllerCount) || 1;
  return Math.round(((seconds / 3600) * session.hourlyRate * controllerCount) * 100) / 100;
}

function intervalSeconds(interval, sessionStartMs, selectedEndMs) {
  const startMs = Math.max(sessionStartMs, new Date(interval.startedAt).getTime());
  const endMs = Math.min(selectedEndMs, new Date(interval.endedAt).getTime());
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function completedPauseSeconds(session, selectedEndMs) {
  const startMs = new Date(session.startedAt).getTime();
  return (session.pauseIntervals ?? []).reduce(
    (total, interval) => total + intervalSeconds(interval, startMs, selectedEndMs),
    0,
  );
}

function adjustedPauseSeconds(session, selectedEndMs) {
  let seconds = completedPauseSeconds(session, selectedEndMs);
  if (session.status === SESSION_STATUS.PAUSED && session.pausedAt) {
    seconds += intervalSeconds({
      startedAt: session.pausedAt,
      endedAt: new Date(selectedEndMs).toISOString(),
    }, new Date(session.startedAt).getTime(), selectedEndMs);
  }
  return seconds;
}

export function createSessionService({
  sessions = sessionRepository,
  stations = stationRepository,
  clock = () => new Date(),
} = {}) {
  async function requireSession(businessId, sessionId) {
    const session = await sessions.findById(businessId, sessionId);
    if (!session) throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
    return session;
  }

  function present(session) {
    const isCancelled = session.status === SESSION_STATUS.CANCELLED;
    const seconds = isCancelled
      ? 0
      : session.status === SESSION_STATUS.COMPLETED
        ? session.finalElapsedSeconds
        : elapsedSeconds(session, clock());
    return {
      ...session,
      elapsedSeconds: seconds,
      currentCost: isCancelled
        ? 0
        : session.status === SESSION_STATUS.COMPLETED
        ? session.finalCost
        : currentCost(session, seconds),
    };
  }

  return {
    async startNew({ businessId, userId, stationId, hourlyRate, controllerCount, startTime }) {
      const now = clock();
      const startedAt = startTime ? new Date(startTime) : now;
      if (startedAt.getTime() > now.getTime()) {
        throw new AppError(400, "startTime cannot be in the future", "INVALID_START_TIME");
      }

      const result = await sessions.startNew({
        businessId,
        startedBy: userId,
        stationId,
        hourlyRate,
        controllerCount,
        startedAt: startedAt.toISOString(),
      });
      if (result.outcome === "forbidden") throw new AppError(403, "Session start is not permitted", "FORBIDDEN");
      if (result.outcome === "station_not_found") throw new AppError(404, "Station not found", "STATION_NOT_FOUND");
      if (result.outcome === "station_unavailable") throw new AppError(409, "Station is not available", "STATION_UNAVAILABLE");
      if (result.outcome === "open_session_exists") throw new AppError(409, "Station already has an open session", "OPEN_SESSION_EXISTS");
      if (result.outcome === "invalid_start_time") throw new AppError(400, "startTime cannot be in the future", "INVALID_START_TIME");
      if (result.outcome === "invalid_controller_count") {
        throw new AppError(400, "controllerCount must be an integer between 1 and 99", "INVALID_CONTROLLER_COUNT");
      }
      if (result.outcome === "controller_count_not_allowed") {
        throw new AppError(400, "controllerCount is only available for PlayStation sessions", "CONTROLLER_COUNT_NOT_ALLOWED");
      }
      if (result.outcome !== "started" || !result.session) {
        throw new AppError(409, "Unable to start session", "SESSION_START_FAILED");
      }
      return present(result.session);
    },

    async create({ businessId, userId, stationId, hourlyRate, controllerCount }) {
      const station = await stations.findById(businessId, stationId);
      if (!station) throw new AppError(404, "Station not found", "STATION_NOT_FOUND");
      if (station.status !== "available") {
        throw new AppError(409, "Station is not available", "STATION_UNAVAILABLE");
      }
      if (await sessions.findOpenByStation(businessId, stationId)) {
        throw new AppError(409, "Station already has an open session", "OPEN_SESSION_EXISTS");
      }
      if (station.type !== "playstation" && controllerCount !== undefined && controllerCount !== 1) {
        throw new AppError(
          400,
          "controllerCount is only available for PlayStation sessions",
          "CONTROLLER_COUNT_NOT_ALLOWED",
        );
      }
      return present(await sessions.create({
        businessId,
        stationId,
        createdBy: userId,
        hourlyRate: hourlyRate ?? station.hourlyRate,
        controllerCount: station.type === "playstation" ? (controllerCount ?? 1) : 1,
      }));
    },

    async getById({ businessId, sessionId }) {
      return present(await requireSession(businessId, sessionId));
    },

    async getActive({ businessId }) {
      return (await sessions.findActive(businessId)).map(present);
    },

    async getFinishedToday({ businessId, timezone, at = clock() }) {
      return sessions.countCompleted(businessId, getPeriodRange("today", timezone, at));
    },

    async getCompleted({ businessId, timezone, filters }) {
      const range = normalizeBusinessRange(filters, timezone);
      if (range.from && range.to && range.from >= range.to) {
        throw new AppError(400, "from must be before to", "INVALID_DATE_RANGE");
      }
      return (await sessions.findCompleted(businessId, {
        ...filters,
        ...range,
      })).map(present);
    },

    async start({ businessId, sessionId, startTime }) {
      const session = await requireSession(businessId, sessionId);
      if (session.status !== SESSION_STATUS.DRAFT) {
        throw new AppError(409, "Only a draft session can be started", "INVALID_SESSION_TRANSITION");
      }
      const station = await stations.findById(businessId, session.stationId);
      if (!station || station.status !== "available") {
        throw new AppError(409, "Station is not available", "STATION_UNAVAILABLE");
      }
      const now = clock();
      const startedAt = startTime ? new Date(startTime) : now;
      if (startedAt.getTime() > now.getTime()) {
        throw new AppError(400, "startTime cannot be in the future", "INVALID_START_TIME");
      }
      const updated = await sessions.update(businessId, sessionId, {
        status: SESSION_STATUS.ACTIVE,
        started_at: startedAt.toISOString(),
        paused_at: null,
        total_paused_seconds: 0,
        pause_intervals: [],
      });
      await stations.updateStatus(businessId, session.stationId, "active");
      return present(updated);
    },

    async pause({ businessId, sessionId, pausedAt }) {
      const session = await requireSession(businessId, sessionId);
      if (session.status !== SESSION_STATUS.ACTIVE) {
        throw new AppError(409, "Only an active session can be paused", "INVALID_SESSION_TRANSITION");
      }
      const now = clock();
      const selectedPause = pausedAt === undefined ? now : new Date(pausedAt);
      const selectedPauseMs = selectedPause.getTime();
      const startMs = new Date(session.startedAt).getTime();
      if (!Number.isFinite(selectedPauseMs)) {
        throw new AppError(400, "pausedAt must be a valid ISO date", "INVALID_PAUSE_TIME");
      }
      if (selectedPauseMs < startMs) {
        throw new AppError(400, "pausedAt cannot be before the session start", "INVALID_PAUSE_TIME");
      }
      if (selectedPauseMs > now.getTime()) {
        throw new AppError(400, "pausedAt cannot be in the future", "INVALID_PAUSE_TIME");
      }
      const updated = await sessions.update(businessId, sessionId, {
        status: SESSION_STATUS.PAUSED,
        paused_at: selectedPause.toISOString(),
      });
      await stations.updateStatus(businessId, session.stationId, "paused");
      return present(updated);
    },

    async resume({ businessId, sessionId }) {
      const session = await requireSession(businessId, sessionId);
      if (session.status !== SESSION_STATUS.PAUSED) {
        throw new AppError(409, "Only a paused session can be resumed", "INVALID_SESSION_TRANSITION");
      }
      const now = clock();
      const pausedDuration = Math.max(0, Math.floor(
        (now.getTime() - new Date(session.pausedAt).getTime()) / 1000,
      ));
      const updated = await sessions.update(businessId, sessionId, {
        status: SESSION_STATUS.ACTIVE,
        paused_at: null,
        total_paused_seconds: session.totalPausedSeconds + pausedDuration,
        pause_intervals: [
          ...(session.pauseIntervals ?? []),
          { startedAt: session.pausedAt, endedAt: now.toISOString() },
        ],
      });
      await stations.updateStatus(businessId, session.stationId, "active");
      return present(updated);
    },

    async update({ businessId, sessionId, hourlyRate, controllerCount, startTime }) {
      const session = await requireSession(businessId, sessionId);
      if ([SESSION_STATUS.COMPLETED, SESSION_STATUS.CANCELLED].includes(session.status)) {
        throw new AppError(409, "Completed or cancelled sessions cannot be edited", "INVALID_SESSION_TRANSITION");
      }
      const values = {};
      if (hourlyRate !== undefined) values.hourly_rate = hourlyRate;
      if (controllerCount !== undefined) {
        const station = await stations.findById(businessId, session.stationId);
        if (!station) throw new AppError(404, "Station not found", "STATION_NOT_FOUND");
        if (station.type !== "playstation") {
          throw new AppError(
            400,
            "controllerCount is only available for PlayStation sessions",
            "CONTROLLER_COUNT_NOT_ALLOWED",
          );
        }
        values.controller_count = controllerCount;
      }
      if (startTime !== undefined) {
        const start = new Date(startTime);
        if (start.getTime() > clock().getTime()) {
          throw new AppError(400, "startTime cannot be in the future", "INVALID_START_TIME");
        }
        values.started_at = start.toISOString();
      }
      return present(await sessions.update(businessId, sessionId, values));
    },

    async end({ businessId, sessionId, userId, endedAt }) {
      const session = await requireSession(businessId, sessionId);
      if (![SESSION_STATUS.ACTIVE, SESSION_STATUS.PAUSED].includes(session.status)) {
        throw new AppError(409, "Only an active or paused session can be ended", "INVALID_SESSION_TRANSITION");
      }
      const now = clock();
      const selectedEnd = endedAt === undefined ? now : new Date(endedAt);
      const selectedEndMs = selectedEnd.getTime();
      const startMs = new Date(session.startedAt).getTime();
      if (!Number.isFinite(selectedEndMs)) {
        throw new AppError(400, "endedAt must be a valid ISO date", "INVALID_END_TIME");
      }
      if (selectedEndMs < startMs) {
        throw new AppError(400, "endedAt cannot be before the session start", "INVALID_END_TIME");
      }
      if (selectedEndMs > now.getTime()) {
        throw new AppError(400, "endedAt cannot be in the future", "INVALID_END_TIME");
      }

      const trackedCompletedSeconds = completedPauseSeconds(session, Number.POSITIVE_INFINITY);
      const legacyPausedSeconds = Math.max(0, session.totalPausedSeconds - trackedCompletedSeconds);
      if (endedAt !== undefined && legacyPausedSeconds > 0) {
        throw new AppError(
          409,
          "Adjusted end time is unavailable for this older session because its pause history was not recorded",
          "ADJUSTED_END_UNAVAILABLE",
        );
      }

      let totalPausedSeconds;
      if (endedAt !== undefined) {
        totalPausedSeconds = adjustedPauseSeconds(session, selectedEndMs);
      } else {
        totalPausedSeconds = session.totalPausedSeconds;
        if (session.status === SESSION_STATUS.PAUSED) {
          totalPausedSeconds += Math.max(0, Math.floor((now.getTime() - new Date(session.pausedAt).getTime()) / 1000));
        }
      }
      const seconds = Math.max(0, Math.floor((selectedEndMs - startMs) / 1000) - totalPausedSeconds);
      const cost = currentCost(session, seconds);
      const pauseIntervals = session.status === SESSION_STATUS.PAUSED
        ? [...(session.pauseIntervals ?? []), { startedAt: session.pausedAt, endedAt: now.toISOString() }]
        : (session.pauseIntervals ?? []);
      const result = await sessions.complete({
        businessId,
        sessionId,
        endedBy: userId,
        endedAt: selectedEnd.toISOString(),
        expectedUpdatedAt: session.updatedAt,
        totalPausedSeconds,
        finalElapsedSeconds: seconds,
        finalCost: cost,
        pauseIntervals,
      });
      if (result.outcome === "not_found") throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
      if (result.outcome === "forbidden") throw new AppError(403, "Session completion is not permitted", "FORBIDDEN");
      if (result.outcome === "conflict") throw new AppError(409, "Session changed while it was being ended", "SESSION_CONFLICT");
      if (result.outcome !== "completed" || !result.session) {
        throw new AppError(409, "Only an active or paused session can be ended", "INVALID_SESSION_TRANSITION");
      }
      return present(result.session);
    },

    async cancel({ businessId, sessionId, userId }) {
      const result = await sessions.cancel(businessId, sessionId, userId);
      if (result.outcome === "not_found") {
        throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
      }
      if (result.outcome === "forbidden") {
        throw new AppError(403, "Session cancellation is not permitted", "FORBIDDEN");
      }
      if (result.outcome !== "cancelled" || !result.session) {
        throw new AppError(409, "Only an active or paused session can be cancelled", "INVALID_SESSION_TRANSITION");
      }
      return present(result.session);
    },

    async remove({ businessId, sessionId, userId, role }) {
      const session = await requireSession(businessId, sessionId);
      if (![SESSION_STATUS.DRAFT, SESSION_STATUS.COMPLETED].includes(session.status)) {
        throw new AppError(409, "Active or paused sessions must be ended first", "INVALID_SESSION_TRANSITION");
      }
      if (role === "employee" && (session.status !== SESSION_STATUS.DRAFT || session.createdBy !== userId)) {
        throw new AppError(403, "Employees can only remove their own draft sessions", "SESSION_DELETE_FORBIDDEN");
      }
      await sessions.remove(businessId, sessionId);
    },
  };
}

export const sessionService = createSessionService();
