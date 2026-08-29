import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDateTimeInput,
  formatZonedTimeInput,
  getAdjustedSessionPreview,
  getCurrentCost,
  zonedDateTimeToTimestamp,
  zonedTimeToTimestamp,
} from "../src/utils/session.js";

test("lounge-local date time round-trips without using the browser timezone", () => {
  const timestamp = zonedDateTimeToTimestamp("2026-08-27T14:30", "Asia/Beirut");
  assert.equal(new Date(timestamp).toISOString(), "2026-08-27T11:30:00.000Z");
  assert.equal(formatDateTimeInput(timestamp, "Asia/Beirut"), "2026-08-27T14:30");
});

test("time-only end input uses the lounge day and supports crossing midnight", () => {
  const now = Date.parse("2026-08-27T22:30:00.000Z"); // 01:30 on Aug 28 in Beirut
  assert.equal(formatZonedTimeInput(now, "Asia/Beirut"), "01:30");
  assert.equal(
    new Date(zonedTimeToTimestamp("00:45", "Asia/Beirut", now)).toISOString(),
    "2026-08-27T21:45:00.000Z",
  );
  assert.equal(
    new Date(zonedTimeToTimestamp("23:45", "Asia/Beirut", now)).toISOString(),
    "2026-08-27T20:45:00.000Z",
  );
});

test("nonexistent daylight-saving local times are rejected", () => {
  assert.equal(zonedDateTimeToTimestamp("2026-03-08T02:30", "America/New_York"), null);
});

test("adjusted preview clips pauses and ignores intervals after the end", () => {
  const preview = getAdjustedSessionPreview({
    status: "paused",
    sessionStartAt: Date.parse("2026-08-27T10:00:00.000Z"),
    pausedAt: Date.parse("2026-08-27T10:50:00.000Z"),
    totalPausedMs: 20 * 60 * 1000,
    hourlyRate: 12,
    pauseIntervals: [
      { startedAt: "2026-08-27T10:20:00.000Z", endedAt: "2026-08-27T10:40:00.000Z" },
    ],
  }, Date.parse("2026-08-27T10:30:00.000Z"));

  assert.deepEqual(preview, {
    elapsedSeconds: 1200,
    pausedSeconds: 600,
    cost: 4,
    hasUntrackedPause: false,
  });
});

test("preview flags legacy cumulative pause data that cannot be backdated safely", () => {
  const preview = getAdjustedSessionPreview({
    status: "active",
    sessionStartAt: Date.parse("2026-08-27T10:00:00.000Z"),
    totalPausedMs: 300_000,
    hourlyRate: 12,
    pauseIntervals: [],
  }, Date.parse("2026-08-27T10:30:00.000Z"));
  assert.equal(preview.hasUntrackedPause, true);
});

test("PlayStation live cost multiplies the per-controller rate", () => {
  const start = Date.parse("2026-08-27T10:00:00.000Z");
  assert.equal(getCurrentCost({
    type: "playstation",
    status: "active",
    sessionStartAt: start,
    totalPausedMs: 0,
    hourlyRate: 2,
    controllerCount: 3,
  }, start + 3_600_000), 6);
});

test("non-PlayStation live cost ignores controller count", () => {
  const start = Date.parse("2026-08-27T10:00:00.000Z");
  assert.equal(getCurrentCost({
    type: "billiard",
    status: "active",
    sessionStartAt: start,
    totalPausedMs: 0,
    hourlyRate: 2,
    controllerCount: 3,
  }, start + 3_600_000), 2);
});
