import test from "node:test";
import assert from "node:assert/strict";
import { validateStationSync } from "../src/features/stations/station.validation.js";

function station(id) {
  return {
    id,
    type: "billiard",
    number: 1,
    hourlyRate: 12,
    status: "available",
    sessionStartAt: null,
    pausedAt: null,
    totalPausedMs: 0,
    plannedStartAt: null,
  };
}

test("station sync accepts UUID and legacy text station IDs", () => {
  assert.equal(validateStationSync({
    body: { stations: [station("123e4567-e89b-42d3-a456-426614174000")] },
  }).success, true);
  assert.equal(validateStationSync({
    body: { stations: [station("station-1")] },
  }).success, true);
});

test("station sync still rejects unsafe or malformed station IDs", () => {
  for (const id of ["", " station-1", "station/1", "x".repeat(129)]) {
    assert.equal(validateStationSync({ body: { stations: [station(id)] } }).success, false);
  }
});

test("station sync accepts an empty list used to delete the last station", () => {
  assert.deepEqual(validateStationSync({ body: { stations: [] } }), {
    success: true,
    data: { stations: [] },
  });
});

test("station sync accepts a positive exchange rate and safely supports legacy stations", () => {
  const withExchangeRate = station("station-1");
  withExchangeRate.exchangeRate = 90000;
  assert.equal(validateStationSync({ body: { stations: [withExchangeRate] } }).data.stations[0].exchangeRate, 90000);

  assert.equal(validateStationSync({ body: { stations: [station("station-1")] } }).success, true);
});

test("station sync rejects non-positive exchange rates", () => {
  for (const exchangeRate of [0, -1, "not-a-number"]) {
    assert.equal(validateStationSync({
      body: { stations: [{ ...station("station-1"), exchangeRate }] },
    }).success, false);
  }
});
