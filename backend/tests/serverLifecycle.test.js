import test from "node:test";
import assert from "node:assert/strict";
import { createShutdownHandler } from "../src/serverLifecycle.js";

test("graceful shutdown drains once and exits cleanly", async () => {
  const events = [];
  const timer = { unref() { events.push("unref"); } };
  const shutdown = createShutdownHandler({
    server: { close(callback) { events.push("close"); callback(); } },
    exit(code) { events.push(["exit", code]); },
    logger: { log(message) { events.push(message); }, error(message) { events.push(message); } },
    setTimer() { return timer; },
    clearTimer(value) { assert.equal(value, timer); events.push("clear"); },
  });

  shutdown("SIGTERM");
  shutdown("SIGTERM");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, [
    "Received SIGTERM; draining active requests",
    "unref",
    "close",
    "clear",
    "Server shutdown complete",
    ["exit", 0],
  ]);
});
