import test from "node:test";
import assert from "node:assert/strict";
import { stationConfigurationSignature } from "../src/lib/stationPersistence.js";

const station = {
  id: "station-1", type: "billiard", number: 1, hourlyRate: 12,
  plannedStartAt: null, status: "available", sessionStartAt: null,
  pausedAt: null, totalPausedMs: 0,
};

test("live timer and session state do not change the persisted configuration signature", () => {
  const baseline = stationConfigurationSignature([station]);
  const live = {
    ...station, status: "active", sessionStartAt: Date.now(), pausedAt: Date.now(), totalPausedMs: 5000,
  };
  assert.equal(stationConfigurationSignature([live]), baseline);
});

test("editable station configuration changes the persistence signature", () => {
  const baseline = stationConfigurationSignature([station]);
  assert.notEqual(stationConfigurationSignature([{ ...station, hourlyRate: 18 }]), baseline);
  assert.notEqual(stationConfigurationSignature([{ ...station, plannedStartAt: 1234 }]), baseline);
});
