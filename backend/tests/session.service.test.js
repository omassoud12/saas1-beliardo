import test from "node:test";
import assert from "node:assert/strict";
import { createSessionService } from "../src/features/sessions/session.service.js";
import {
  validateCreateSession,
  validateEndSession,
  validatePauseSession,
  validateStartNewSession,
  validateUpdateSession,
} from "../src/features/sessions/session.validation.js";

function createHarness({ cancelFailure = null, endFailure = null, stationType = "billiard", hourlyRate = 12 } = {}) {
  let now = new Date("2026-08-24T10:00:00.000Z");
  const station = { id: "station-1", status: "available", type: stationType, hourlyRate };
  const records = new Map();
  const calls = { startNew: 0 };
  let sequence = 0;
  const mapFields = {
    started_at: "startedAt", paused_at: "pausedAt", ended_at: "endedAt",
    total_paused_seconds: "totalPausedSeconds", final_elapsed_seconds: "finalElapsedSeconds",
    final_cost: "finalCost", hourly_rate: "hourlyRate", controller_count: "controllerCount",
    cancelled_at: "cancelledAt", cancelled_by: "cancelledBy",
    ended_recorded_at: "endedRecordedAt", ended_by: "endedBy", pause_intervals: "pauseIntervals",
  };
  const sessions = {
    async startNew(values) {
      calls.startNew += 1;
      if (station.status !== "available") return { outcome: "station_unavailable", session: null };
      const openSession = [...records.values()].find((record) => (
        record.businessId === values.businessId
        && record.stationId === values.stationId
        && ["draft", "active", "paused"].includes(record.status)
      ));
      if (openSession) return { outcome: "open_session_exists", session: null };
      if (station.type !== "playstation" && values.controllerCount !== undefined && values.controllerCount !== 1) {
        return { outcome: "controller_count_not_allowed", session: null };
      }
      const record = {
        id: `session-${++sequence}`, stationId: values.stationId, businessId: values.businessId,
        createdBy: values.startedBy, status: "active", hourlyRate: values.hourlyRate ?? station.hourlyRate,
        controllerCount: station.type === "playstation" ? (values.controllerCount ?? 1) : 1,
        startedAt: values.startedAt, pausedAt: null, endedAt: null, totalPausedSeconds: 0,
        finalElapsedSeconds: null, finalCost: null, cancelledAt: null, cancelledBy: null,
        endedRecordedAt: null, endedBy: null, pauseIntervals: [], updatedAt: now.toISOString(),
      };
      records.set(record.id, record);
      station.status = "active";
      return { outcome: "started", session: { ...record } };
    },
    async create(values) {
      const record = {
        id: `session-${++sequence}`, stationId: values.stationId, businessId: values.businessId,
        createdBy: values.createdBy, status: "draft", hourlyRate: values.hourlyRate,
        controllerCount: values.controllerCount,
        startedAt: null, pausedAt: null, endedAt: null, totalPausedSeconds: 0,
        finalElapsedSeconds: null, finalCost: null, cancelledAt: null, cancelledBy: null,
        endedRecordedAt: null, endedBy: null, pauseIntervals: [], updatedAt: now.toISOString(),
      };
      records.set(record.id, record);
      return { ...record };
    },
    async findById(businessId, id) {
      const record = records.get(id);
      return record?.businessId === businessId ? { ...record } : null;
    },
    async findOpenByStation(businessId, stationId) {
      return [...records.values()].find((record) =>
        record.businessId === businessId && record.stationId === stationId && ["draft", "active", "paused"].includes(record.status),
      ) ?? null;
    },
    async findActive(businessId) {
      return [...records.values()].filter((record) => record.businessId === businessId && ["active", "paused"].includes(record.status));
    },
    async countCompleted(businessId) {
      return [...records.values()].filter((record) => record.businessId === businessId && record.status === "completed").length;
    },
    async findCompleted(businessId) {
      return [...records.values()].filter((record) => record.businessId === businessId && record.status === "completed");
    },
    async update(_businessId, id, values) {
      const record = records.get(id);
      for (const [key, value] of Object.entries(values)) record[mapFields[key] ?? key] = value;
      record.updatedAt = now.toISOString();
      return { ...record };
    },
    async complete(values) {
      if (endFailure) throw endFailure;
      const record = records.get(values.sessionId);
      if (!record || record.businessId !== values.businessId) return { outcome: "not_found", session: null };
      if (!["active", "paused"].includes(record.status)) return { outcome: "invalid_state", session: { ...record } };
      if (record.updatedAt !== values.expectedUpdatedAt) return { outcome: "conflict", session: { ...record } };
      Object.assign(record, {
        status: "completed", endedAt: values.endedAt, endedRecordedAt: now.toISOString(),
        endedBy: values.endedBy, pausedAt: null, totalPausedSeconds: values.totalPausedSeconds,
        finalElapsedSeconds: values.finalElapsedSeconds, finalCost: values.finalCost,
        pauseIntervals: values.pauseIntervals, updatedAt: now.toISOString(),
      });
      station.status = "available";
      return { outcome: "completed", session: { ...record } };
    },
    async cancel(businessId, id, cancelledBy) {
      if (cancelFailure) throw cancelFailure;
      const record = records.get(id);
      if (!record || record.businessId !== businessId) return { outcome: "not_found", session: null };
      if (!["active", "paused"].includes(record.status)) return { outcome: "invalid_state", session: { ...record } };
      Object.assign(record, {
        status: "cancelled", cancelledAt: now.toISOString(), cancelledBy,
        pausedAt: null, totalPausedSeconds: 0, endedAt: null,
        finalElapsedSeconds: null, finalCost: null,
      });
      station.status = "available";
      return { outcome: "cancelled", session: { ...record } };
    },
    async remove(_businessId, id) { records.delete(id); },
  };
  const stations = {
    async findById(_businessId, id) { return id === station.id ? { ...station } : null; },
    async updateStatus(_businessId, _id, status) { station.status = status; return { ...station }; },
  };
  const service = createSessionService({ sessions, stations, clock: () => new Date(now) });
  return {
    service,
    station,
    records,
    calls,
    setTime(value) { now = new Date(value); },
  };
}

test("atomic start creates one active PlayStation session in one repository operation", async () => {
  const harness = createHarness({ stationType: "playstation", hourlyRate: 2 });
  const session = await harness.service.startNew({
    businessId: "business-1",
    userId: "user-1",
    stationId: "station-1",
    hourlyRate: 2,
    controllerCount: 3,
    startTime: "2026-08-24T09:45:00.000Z",
  });

  assert.equal(harness.calls.startNew, 1);
  assert.equal(harness.records.size, 1);
  assert.equal(session.status, "active");
  assert.equal(session.startedAt, "2026-08-24T09:45:00.000Z");
  assert.equal(session.controllerCount, 3);
  assert.equal(session.hourlyRate, 2);
  assert.equal(harness.station.status, "active");
});

test("atomic start rejects a future time before calling the repository", async () => {
  const harness = createHarness();
  await assert.rejects(
    harness.service.startNew({
      businessId: "business-1",
      userId: "user-1",
      stationId: "station-1",
      startTime: "2026-08-24T10:00:01.000Z",
    }),
    (error) => error.statusCode === 400 && error.code === "INVALID_START_TIME",
  );
  assert.equal(harness.calls.startNew, 0);
});

test("session lifecycle excludes paused time and calculates final cost", async () => {
  const harness = createHarness();
  const created = await harness.service.create({
    businessId: "business-1", userId: "user-1", stationId: "station-1",
  });
  const started = await harness.service.start({ businessId: "business-1", sessionId: created.id });
  assert.equal(started.status, "active");
  assert.equal(harness.station.status, "active");

  harness.setTime("2026-08-24T10:30:00.000Z");
  await harness.service.pause({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T10:40:00.000Z");
  const resumed = await harness.service.resume({ businessId: "business-1", sessionId: created.id });
  assert.equal(resumed.totalPausedSeconds, 600);

  harness.setTime("2026-08-24T11:00:00.000Z");
  const ended = await harness.service.end({ businessId: "business-1", sessionId: created.id, userId: "user-1" });
  assert.equal(ended.status, "completed");
  assert.equal(ended.finalElapsedSeconds, 3000);
  assert.equal(ended.finalCost, 10);
  assert.equal(harness.station.status, "available");
});

test("invalid lifecycle transitions are rejected", async () => {
  const { service } = createHarness();
  const created = await service.create({
    businessId: "business-1", userId: "user-1", stationId: "station-1",
  });
  await assert.rejects(
    service.pause({ businessId: "business-1", sessionId: created.id }),
    (error) => error.statusCode === 409 && error.code === "INVALID_SESSION_TRANSITION",
  );
  await service.start({ businessId: "business-1", sessionId: created.id });
  await service.end({ businessId: "business-1", sessionId: created.id, userId: "user-1" });
  await assert.rejects(
    service.end({ businessId: "business-1", sessionId: created.id, userId: "user-1" }),
    (error) => error.statusCode === 409 && error.code === "INVALID_SESSION_TRANSITION",
  );
});

test("captured End Session time freezes billing and Keep Session resumes the same session", async () => {
  const harness = createHarness({ stationType: "playstation", hourlyRate: 2 });
  const created = await harness.service.create({
    businessId: "business-1", userId: "user-1", stationId: "station-1", controllerCount: 2,
  });
  await harness.service.start({ businessId: "business-1", sessionId: created.id });

  harness.setTime("2026-08-24T10:40:00.000Z");
  const paused = await harness.service.pause({
    businessId: "business-1",
    sessionId: created.id,
    pausedAt: "2026-08-24T10:30:00.000Z",
  });
  assert.equal(paused.id, created.id);
  assert.equal(paused.pausedAt, "2026-08-24T10:30:00.000Z");
  assert.equal(paused.controllerCount, 2);

  harness.setTime("2026-08-24T10:50:00.000Z");
  const resumed = await harness.service.resume({ businessId: "business-1", sessionId: created.id });
  assert.equal(resumed.id, created.id);
  assert.equal(resumed.totalPausedSeconds, 1200);
  assert.equal(resumed.controllerCount, 2);

  harness.setTime("2026-08-24T11:20:00.000Z");
  const ended = await harness.service.end({
    businessId: "business-1", sessionId: created.id, userId: "user-1",
  });
  assert.equal(ended.finalElapsedSeconds, 3600);
  assert.equal(ended.finalCost, 4);
});

test("PlayStation controller count multiplies the hourly and final session cost", async () => {
  const harness = createHarness({ stationType: "playstation", hourlyRate: 2 });
  const created = await harness.service.create({
    businessId: "business-1", userId: "user-1", stationId: "station-1", controllerCount: 1,
  });
  assert.equal(created.hourlyRate, 2);
  assert.equal(created.controllerCount, 1);

  await harness.service.start({ businessId: "business-1", sessionId: created.id });
  const updated = await harness.service.update({
    businessId: "business-1", sessionId: created.id, controllerCount: 3,
  });
  assert.equal(updated.controllerCount, 3);
  harness.setTime("2026-08-24T11:00:00.000Z");
  const ended = await harness.service.end({
    businessId: "business-1", sessionId: created.id, userId: "user-1",
  });

  assert.equal(ended.finalElapsedSeconds, 3600);
  assert.equal(ended.finalCost, 6);
});

test("non-PlayStation sessions stay at one controller and reject multi-controller creation", async () => {
  const harness = createHarness({ stationType: "billiard", hourlyRate: 2 });
  await assert.rejects(
    harness.service.create({
      businessId: "business-1", userId: "user-1", stationId: "station-1", controllerCount: 2,
    }),
    (error) => error.statusCode === 400 && error.code === "CONTROLLER_COUNT_NOT_ALLOWED",
  );

  const created = await harness.service.create({
    businessId: "business-1", userId: "user-1", stationId: "station-1",
  });
  assert.equal(created.controllerCount, 1);
  await assert.rejects(
    harness.service.update({ businessId: "business-1", sessionId: created.id, controllerCount: 2 }),
    (error) => error.statusCode === 400 && error.code === "CONTROLLER_COUNT_NOT_ALLOWED",
  );
});

test("finished count uses the lounge's current calendar day", async () => {
  let receivedRange;
  const sessions = {
    async countCompleted(_businessId, range) { receivedRange = range; return 4; },
  };
  const service = createSessionService({
    sessions,
    stations: {},
    clock: () => new Date("2026-08-27T22:30:00.000Z"),
  });

  const count = await service.getFinishedToday({
    businessId: "business-1",
    timezone: "Asia/Beirut",
  });

  assert.equal(count, 4);
  assert.deepEqual(receivedRange, {
    from: "2026-08-27T03:00:00.000Z",
    to: "2026-08-28T03:00:00.000Z",
  });
});

test("cancelling an active session discards billing and frees the station for a new session", async () => {
  const harness = createHarness();
  const created = await harness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await harness.service.start({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T11:30:00.000Z");

  const cancelled = await harness.service.cancel({ businessId: "business-1", sessionId: created.id, userId: "user-1" });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.elapsedSeconds, 0);
  assert.equal(cancelled.currentCost, 0);
  assert.equal(cancelled.finalElapsedSeconds, null);
  assert.equal(cancelled.finalCost, null);
  assert.equal(cancelled.endedAt, null);
  assert.equal(harness.station.status, "available");
  assert.deepEqual(await harness.service.getActive({ businessId: "business-1" }), []);
  assert.deepEqual(await harness.service.getCompleted({ businessId: "business-1", timezone: "UTC", filters: {} }), []);
  assert.equal(await harness.service.getFinishedToday({ businessId: "business-1", timezone: "UTC" }), 0);

  const replacement = await harness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  const restarted = await harness.service.start({ businessId: "business-1", sessionId: replacement.id });
  assert.equal(restarted.status, "active");
});

test("cancelling a paused session resets paused time without completing it", async () => {
  const harness = createHarness();
  const created = await harness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await harness.service.start({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T10:20:00.000Z");
  await harness.service.pause({ businessId: "business-1", sessionId: created.id });
  const cancelled = await harness.service.cancel({ businessId: "business-1", sessionId: created.id, userId: "employee-1" });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.pausedAt, null);
  assert.equal(cancelled.totalPausedSeconds, 0);
  assert.equal(cancelled.cancelledBy, "employee-1");
  assert.equal(harness.station.status, "available");
});

test("completed and already-cancelled sessions reject cancellation safely", async () => {
  const completedHarness = createHarness();
  const completed = await completedHarness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await completedHarness.service.start({ businessId: "business-1", sessionId: completed.id });
  await completedHarness.service.end({ businessId: "business-1", sessionId: completed.id, userId: "user-1" });
  await assert.rejects(
    completedHarness.service.cancel({ businessId: "business-1", sessionId: completed.id, userId: "user-1" }),
    (error) => error.statusCode === 409 && error.code === "INVALID_SESSION_TRANSITION",
  );

  const cancelledHarness = createHarness();
  const cancelled = await cancelledHarness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await cancelledHarness.service.start({ businessId: "business-1", sessionId: cancelled.id });
  await cancelledHarness.service.cancel({ businessId: "business-1", sessionId: cancelled.id, userId: "user-1" });
  await assert.rejects(
    cancelledHarness.service.cancel({ businessId: "business-1", sessionId: cancelled.id, userId: "user-1" }),
    (error) => error.statusCode === 409 && error.code === "INVALID_SESSION_TRANSITION",
  );
  await assert.rejects(
    cancelledHarness.service.update({ businessId: "business-1", sessionId: cancelled.id, hourlyRate: 99 }),
    (error) => error.statusCode === 409 && error.code === "INVALID_SESSION_TRANSITION",
  );
});

test("cross-tenant, unauthorized, and database-failed cancellation preserve station state", async () => {
  const crossTenant = createHarness();
  const created = await crossTenant.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await crossTenant.service.start({ businessId: "business-1", sessionId: created.id });
  await assert.rejects(
    crossTenant.service.cancel({ businessId: "business-2", sessionId: created.id, userId: "user-2" }),
    (error) => error.statusCode === 404 && error.code === "SESSION_NOT_FOUND",
  );
  assert.equal(crossTenant.station.status, "active");

  const service = createSessionService({ sessions: { async cancel() { return { outcome: "forbidden", session: null }; } }, stations: {} });
  await assert.rejects(
    service.cancel({ businessId: "business-1", sessionId: "session-1", userId: "user-2" }),
    (error) => error.statusCode === 403,
  );

  const failed = createHarness({ cancelFailure: new Error("database unavailable") });
  const failedSession = await failed.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await failed.service.start({ businessId: "business-1", sessionId: failedSession.id });
  await assert.rejects(failed.service.cancel({ businessId: "business-1", sessionId: failedSession.id, userId: "user-1" }), /database unavailable/);
  assert.equal(failed.station.status, "active");
  assert.equal(failed.records.get(failedSession.id).status, "active");
});

test("cancellation across the 06:00 boundary never contributes to either day", async () => {
  const harness = createHarness();
  harness.setTime("2026-08-27T02:59:00.000Z");
  const created = await harness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await harness.service.start({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-27T03:01:00.000Z");
  await harness.service.cancel({ businessId: "business-1", sessionId: created.id, userId: "user-1" });
  assert.equal(await harness.service.getFinishedToday({ businessId: "business-1", timezone: "Asia/Beirut", at: new Date("2026-08-27T02:59:00.000Z") }), 0);
  assert.equal(await harness.service.getFinishedToday({ businessId: "business-1", timezone: "Asia/Beirut", at: new Date("2026-08-27T03:01:00.000Z") }), 0);
});

test("adjusted end ignores pauses after the selection and clips a pause containing it", async () => {
  const harness = createHarness();
  const created = await harness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await harness.service.start({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T10:20:00.000Z");
  await harness.service.pause({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T10:40:00.000Z");
  await harness.service.resume({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T10:50:00.000Z");
  await harness.service.pause({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T11:00:00.000Z");

  const ended = await harness.service.end({
    businessId: "business-1", sessionId: created.id, userId: "employee-1",
    endedAt: "2026-08-24T10:30:00.000Z",
  });
  assert.equal(ended.endedAt, "2026-08-24T10:30:00.000Z");
  assert.equal(ended.totalPausedSeconds, 600);
  assert.equal(ended.finalElapsedSeconds, 1200);
  assert.equal(ended.finalCost, 4);
  assert.equal(ended.endedBy, "employee-1");
  assert.equal(ended.endedRecordedAt, "2026-08-24T11:00:00.000Z");
  assert.equal(harness.station.status, "available");
});

test("adjusted end after a completed pause preserves rounding and billing", async () => {
  const harness = createHarness();
  const created = await harness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await harness.service.start({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T10:20:00.900Z");
  await harness.service.pause({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T10:30:00.100Z");
  await harness.service.resume({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T11:00:00.000Z");
  const ended = await harness.service.end({
    businessId: "business-1", sessionId: created.id, userId: "user-1",
    endedAt: "2026-08-24T10:45:00.900Z",
  });
  assert.equal(ended.totalPausedSeconds, 599);
  assert.equal(ended.finalElapsedSeconds, 2101);
  assert.equal(ended.finalCost, 7);
});

test("adjusted end rejects invalid boundaries and legacy untracked pauses", async () => {
  const harness = createHarness();
  const created = await harness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await harness.service.start({ businessId: "business-1", sessionId: created.id });
  harness.setTime("2026-08-24T11:00:00.000Z");

  await assert.rejects(
    harness.service.end({ businessId: "business-1", sessionId: created.id, userId: "user-1", endedAt: "2026-08-24T09:59:59.000Z" }),
    (error) => error.statusCode === 400 && error.code === "INVALID_END_TIME",
  );
  await assert.rejects(
    harness.service.end({ businessId: "business-1", sessionId: created.id, userId: "user-1", endedAt: "2026-08-24T11:00:01.000Z" }),
    (error) => error.statusCode === 400 && error.code === "INVALID_END_TIME",
  );
  await assert.rejects(
    harness.service.end({ businessId: "business-1", sessionId: created.id, userId: "user-1", endedAt: "not-a-date" }),
    (error) => error.statusCode === 400 && error.code === "INVALID_END_TIME",
  );

  harness.records.get(created.id).totalPausedSeconds = 300;
  await assert.rejects(
    harness.service.end({ businessId: "business-1", sessionId: created.id, userId: "user-1", endedAt: "2026-08-24T10:30:00.000Z" }),
    (error) => error.statusCode === 409 && error.code === "ADJUSTED_END_UNAVAILABLE",
  );
  assert.equal(harness.station.status, "active");
});

test("failed atomic completion leaves the live session and station unchanged", async () => {
  const harness = createHarness({ endFailure: new Error("database unavailable") });
  const created = await harness.service.create({ businessId: "business-1", userId: "user-1", stationId: "station-1" });
  await harness.service.start({ businessId: "business-1", sessionId: created.id });
  await assert.rejects(
    harness.service.end({ businessId: "business-1", sessionId: created.id, userId: "user-1" }),
    /database unavailable/,
  );
  assert.equal(harness.records.get(created.id).status, "active");
  assert.equal(harness.station.status, "active");
});

test("end request validation accepts an optional ISO timestamp and rejects date-only input", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.deepEqual(validateEndSession({ params: { id }, body: {} }), {
    success: true, data: { sessionId: id, endedAt: undefined },
  });
  assert.equal(validateEndSession({ params: { id }, body: { endedAt: "2026-08-27" } }).success, false);
  assert.deepEqual(validateEndSession({ params: { id }, body: { endedAt: "2026-08-27T11:30:00+03:00" } }), {
    success: true, data: { sessionId: id, endedAt: "2026-08-27T08:30:00.000Z" },
  });
});

test("pause request validation accepts an optional captured ISO timestamp", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.deepEqual(validatePauseSession({ params: { id }, body: {} }), {
    success: true, data: { sessionId: id, pausedAt: undefined },
  });
  assert.equal(validatePauseSession({ params: { id }, body: { pausedAt: "2026-08-27" } }).success, false);
  assert.deepEqual(validatePauseSession({ params: { id }, body: { pausedAt: "2026-08-27T11:30:00+03:00" } }), {
    success: true, data: { sessionId: id, pausedAt: "2026-08-27T08:30:00.000Z" },
  });
});

test("atomic start request validation combines creation and start fields", () => {
  const stationId = "123e4567-e89b-42d3-a456-426614174000";
  assert.deepEqual(validateStartNewSession({
    params: {},
    body: {
      stationId,
      hourlyRate: 2,
      controllerCount: 3,
      startTime: "2026-08-27T11:30:00+03:00",
    },
  }), {
    success: true,
    data: {
      stationId,
      hourlyRate: 2,
      controllerCount: 3,
      startTime: "2026-08-27T08:30:00.000Z",
    },
  });
});

test("create request validation accepts only bounded integer controller counts", () => {
  const stationId = "123e4567-e89b-42d3-a456-426614174000";
  assert.deepEqual(validateCreateSession({ params: {}, body: { stationId, hourlyRate: 2, controllerCount: 3 } }), {
    success: true,
    data: { stationId, hourlyRate: 2, controllerCount: 3 },
  });
  assert.equal(validateCreateSession({ params: {}, body: { stationId, controllerCount: 0 } }).success, false);
  assert.equal(validateCreateSession({ params: {}, body: { stationId, controllerCount: 2.5 } }).success, false);
  assert.equal(validateCreateSession({ params: {}, body: { stationId, controllerCount: 100 } }).success, false);
});

test("update request validation accepts a live controller count change", () => {
  const sessionId = "123e4567-e89b-42d3-a456-426614174000";
  assert.deepEqual(validateUpdateSession({ params: { id: sessionId }, body: { controllerCount: 4 } }), {
    success: true,
    data: { sessionId, hourlyRate: undefined, controllerCount: 4, startTime: undefined },
  });
});
