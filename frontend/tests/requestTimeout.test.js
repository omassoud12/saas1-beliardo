import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithTimeout } from "../src/lib/requestTimeout.js";

test("API requests fail with a specific error instead of staying pending forever", async () => {
  const neverFinishes = (_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });

  await assert.rejects(
    fetchWithTimeout("https://example.test", {}, { timeoutMs: 5, fetchImpl: neverFinishes }),
    { code: "REQUEST_TIMEOUT" },
  );
});

test("API request timeout is cleared after a successful response", async () => {
  const response = { ok: true };
  assert.equal(
    await fetchWithTimeout("https://example.test", {}, { timeoutMs: 50, fetchImpl: async () => response }),
    response,
  );
});
