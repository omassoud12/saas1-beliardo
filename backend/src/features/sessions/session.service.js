import { stationRepository } from "../stations/station.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { SESSION_STATUS } from "../../shared/constants/session.js";
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
  return Math.round(((seconds / 3600) * session.hourlyRate) * 100) / 100;
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
    const seconds = session.status === SESSION_STATUS.COMPLETED
      ? session.finalElapsedSeconds
      : elapsedSeconds(session, clock());
    return {
      ...session,
      elapsedSeconds: seconds,
      currentCost: session.status === SESSION_STATUS.COMPLETED
        ? session.finalCost
        : currentCost(session, seconds),
    };
  }

  return {
    async create({ businessId, userId, stationId, hourlyRate }) {
      const station = await stations.findById(businessId, stationId);
      if (!station) throw new AppError(404, "Station not found", "STATION_NOT_FOUND");
      if (station.status !== "available") {
        throw new AppError(409, "Station is not available", "STATION_UNAVAILABLE");
      }
      if (await sessions.findOpenByStation(businessId, stationId)) {
        throw new AppError(409, "Station already has an open session", "OPEN_SESSION_EXISTS");
      }
      return present(await sessions.create({
        businessId,
        stationId,
        createdBy: userId,
        hourlyRate: hourlyRate ?? station.hourlyRate,
      }));
    },

    async getById({ businessId, sessionId }) {
      return present(await requireSession(businessId, sessionId));
    },

    async getActive({ businessId }) {
      return (await sessions.findActive(businessId)).map(present);
    },

    async getCompleted({ businessId, filters }) {
      return (await sessions.findCompleted(businessId, filters)).map(present);
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
      });
      await stations.updateStatus(businessId, session.stationId, "active");
      return present(updated);
    },

    async pause({ businessId, sessionId }) {
      const session = await requireSession(businessId, sessionId);
      if (session.status !== SESSION_STATUS.ACTIVE) {
        throw new AppError(409, "Only an active session can be paused", "INVALID_SESSION_TRANSITION");
      }
      const updated = await sessions.update(businessId, sessionId, {
        status: SESSION_STATUS.PAUSED,
        paused_at: clock().toISOString(),
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
      });
      await stations.updateStatus(businessId, session.stationId, "active");
      return present(updated);
    },

    async update({ businessId, sessionId, hourlyRate, startTime }) {
      const session = await requireSession(businessId, sessionId);
      if (session.status === SESSION_STATUS.COMPLETED) {
        throw new AppError(409, "Completed sessions cannot be edited", "INVALID_SESSION_TRANSITION");
      }
      const values = {};
      if (hourlyRate !== undefined) values.hourly_rate = hourlyRate;
      if (startTime !== undefined) {
        const start = new Date(startTime);
        if (start.getTime() > clock().getTime()) {
          throw new AppError(400, "startTime cannot be in the future", "INVALID_START_TIME");
        }
        values.started_at = start.toISOString();
      }
      return present(await sessions.update(businessId, sessionId, values));
    },

    async end({ businessId, sessionId }) {
      const session = await requireSession(businessId, sessionId);
      if (![SESSION_STATUS.ACTIVE, SESSION_STATUS.PAUSED].includes(session.status)) {
        throw new AppError(409, "Only an active or paused session can be ended", "INVALID_SESSION_TRANSITION");
      }
      const now = clock();
      let totalPausedSeconds = session.totalPausedSeconds;
      if (session.status === SESSION_STATUS.PAUSED) {
        totalPausedSeconds += Math.max(0, Math.floor(
          (now.getTime() - new Date(session.pausedAt).getTime()) / 1000,
        ));
      }
      const seconds = Math.max(0, Math.floor(
        (now.getTime() - new Date(session.startedAt).getTime()) / 1000 - totalPausedSeconds,
      ));
      const cost = currentCost(session, seconds);
      const updated = await sessions.update(businessId, sessionId, {
        status: SESSION_STATUS.COMPLETED,
        ended_at: now.toISOString(),
        paused_at: null,
        total_paused_seconds: totalPausedSeconds,
        final_elapsed_seconds: seconds,
        final_cost: cost,
      });
      await stations.updateStatus(businessId, session.stationId, "available");
      return present(updated);
    },

    async remove({ businessId, sessionId }) {
      const session = await requireSession(businessId, sessionId);
      if (![SESSION_STATUS.DRAFT, SESSION_STATUS.COMPLETED].includes(session.status)) {
        throw new AppError(409, "Active or paused sessions must be ended first", "INVALID_SESSION_TRANSITION");
      }
      await sessions.remove(businessId, sessionId);
    },
  };
}

export const sessionService = createSessionService();
