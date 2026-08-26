import test from "node:test";
import assert from "node:assert/strict";
import { createSessionService } from "../src/features/sessions/session.service.js";

function createHarness() {
  let now = new Date("2026-08-24T10:00:00.000Z");
  const station = { id: "station-1", status: "available", hourlyRate: 12 };
  const records = new Map();
  let sequence = 0;
  const mapFields = {
    started_at: "startedAt", paused_at: "pausedAt", ended_at: "endedAt",
    total_paused_seconds: "totalPausedSeconds", final_elapsed_seconds: "finalElapsedSeconds",
    final_cost: "finalCost", hourly_rate: "hourlyRate",
  };
  const sessions = {
    async create(values) {
      const record = {
        id: `session-${++sequence}`, stationId: values.stationId, businessId: values.businessId,
        createdBy: values.createdBy, status: "draft", hourlyRate: values.hourlyRate,
        startedAt: null, pausedAt: null, endedAt: null, totalPausedSeconds: 0,
        finalElapsedSeconds: null, finalCost: null,
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
        record.businessId === businessId && record.stationId === stationId && record.status !== "completed",
      ) ?? null;
    },
    async findActive() { return []; },
    async countCompleted() { return 0; },
    async findCompleted() { return []; },
    async update(_businessId, id, values) {
      const record = records.get(id);
      for (const [key, value] of Object.entries(values)) record[mapFields[key] ?? key] = value;
      return { ...record };
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
    setTime(value) { now = new Date(value); },
  };
}

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
  const ended = await harness.service.end({ businessId: "business-1", sessionId: created.id });
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
  await service.end({ businessId: "business-1", sessionId: created.id });
  await assert.rejects(
    service.end({ businessId: "business-1", sessionId: created.id }),
    (error) => error.statusCode === 409 && error.code === "INVALID_SESSION_TRANSITION",
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
    from: "2026-08-27T21:00:00.000Z",
    to: "2026-08-28T21:00:00.000Z",
  });
});
