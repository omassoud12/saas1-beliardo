import test from "node:test";
import assert from "node:assert/strict";
import { createStationService } from "../src/features/stations/station.service.js";

function createRepository(status = "available") {
  const calls = { archived: [], upserted: [] };
  const existing = [
    { id: "station-1", type: "billiard", number: 1, hourlyRate: 10, status },
    { id: "station-2", type: "billiard", number: 2, hourlyRate: 10, status: "available" },
  ];
  return {
    calls,
    async list() { return existing.filter((station) => !calls.archived.includes(station.id)); },
    async sync(_businessId, _actorUserId, stations) {
      const desiredIds = new Set(stations.map((station) => station.id));
      const removed = existing.filter((station) => !desiredIds.has(station.id));
      if (removed.some((station) => station.status !== "available")) return { outcome: "station_in_use", stations: [] };
      calls.archived.push(...removed.map((station) => station.id));
      calls.upserted.push(...stations);
      return { outcome: "synchronized", stations };
    },
  };
}

test("station sync archives removed stations instead of deleting session history", async () => {
  const repository = createRepository();
  const service = createStationService({ repository });
  await service.sync("business-1", "owner-1", [{
    id: "station-2", type: "billiard", number: 2, hourlyRate: 10,
  }]);
  assert.deepEqual(repository.calls.archived, ["station-1"]);
});

test("station sync refuses to archive a station with a live session", async () => {
  const repository = createRepository("active");
  const service = createStationService({ repository });
  await assert.rejects(
    service.sync("business-1", "owner-1", [{
      id: "station-2", type: "billiard", number: 2, hourlyRate: 10,
    }]),
    (error) => error.statusCode === 409 && error.code === "STATION_IN_USE",
  );
  assert.deepEqual(repository.calls.archived, []);
  assert.deepEqual(repository.calls.upserted, []);
});
