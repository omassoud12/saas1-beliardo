import test from "node:test";
import assert from "node:assert/strict";
import { validateCompletedSessionEdit } from "../src/features/sessions/session.validation.js";
import { createSessionService } from "../src/features/sessions/session.service.js";
const request = (body) => ({ params: { id: "12345678-1234-4234-8234-123456789012" }, body });
const values = { durationSeconds: 1833, finalCost: 1.12, expectedUpdatedAt: "2026-10-04T10:00:00.123456Z" };
test("correction preserves timestamp precision for optimistic locking", () => {
  const result = validateCompletedSessionEdit(request(values));
  assert.equal(result.success, true);
  assert.equal(result.data.expectedUpdatedAt, values.expectedUpdatedAt);
});
test("rejects invalid durations, costs, and missing concurrency token", () => {
  for (const changes of [{durationSeconds: -1}, {durationSeconds: 1.5}, {durationSeconds: 31536001}, {finalCost: -1}, {finalCost: 1.123}, {finalCost: "1.12"}, {expectedUpdatedAt: undefined}]) {
    assert.equal(validateCompletedSessionEdit(request({...values, ...changes})).success, false);
  }
});
test("allows zero duration and free sessions", () => {
  assert.equal(validateCompletedSessionEdit(request({...values, durationSeconds: 0, finalCost: 0})).success, true);
});
test("successful correction presents stored duration and cost", async () => {
  let received;
  const service = createSessionService({ sessions: { async editCompleted(input) {
    received = input;
    return {outcome: "updated", session: {id: input.sessionId, status: "completed", finalElapsedSeconds: input.durationSeconds, finalCost: input.finalCost}};
  }}});
  const result = await service.editCompleted({...values, businessId: "tenant", sessionId: "session", userId: "actor"});
  assert.equal(received.businessId, "tenant");
  assert.equal(result.elapsedSeconds, 1833);
  assert.equal(result.currentCost, 1.12);
});
test("maps forbidden, missing, stale, and transition failures", async () => {
  for (const [outcome, status] of [["forbidden",403], ["not_found",404], ["stale",409], ["invalid_transition",409], ["invalid_values",400]]) {
    const service = createSessionService({sessions: {async editCompleted() {return {outcome};}}});
    await assert.rejects(service.editCompleted(values), error => error.statusCode === status);
  }
});
