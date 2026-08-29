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
    async findOwnedIds() { return existing.map(({ id }) => ({ id, business_id: "business-1" })); },
    async upsert(_businessId, stations) { calls.upserted.push(...stations); },
    async archiveByIds(_businessId, ids) { calls.archived.push(...ids); },
  };
}

test("station sync archives removed stations instead of deleting session history", async () => {
  const repository = createRepository();
  const service = createStationService({ repository });
  await service.sync("business-1", [{
    id: "station-2", type: "billiard", number: 2, hourlyRate: 10, status: "available",
  }]);
  assert.deepEqual(repository.calls.archived, ["station-1"]);
});

test("station sync refuses to archive a station with a live session", async () => {
  const repository = createRepository("active");
  const service = createStationService({ repository });
  await assert.rejects(
    service.sync("business-1", [{
      id: "station-2", type: "billiard", number: 2, hourlyRate: 10, status: "available",
    }]),
    (error) => error.statusCode === 409 && error.code === "STATION_IN_USE",
  );
  assert.deepEqual(repository.calls.archived, []);
  assert.deepEqual(repository.calls.upserted, []);
});
