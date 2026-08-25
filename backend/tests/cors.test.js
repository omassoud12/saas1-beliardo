import test from "node:test";
import assert from "node:assert/strict";
import { cors } from "../src/middleware/cors.js";

test("CORS preflight allows every HTTP method used by the API", () => {
  const headers = {};
  let statusCode;
  const request = { method: "OPTIONS", headers: { origin: "http://localhost:5173" } };
  const response = {
    setHeader(name, value) { headers[name] = value; },
    sendStatus(value) { statusCode = value; },
  };

  cors(request, response, () => assert.fail("preflight must finish in CORS middleware"));

  assert.equal(statusCode, 204);
  assert.equal(headers["Access-Control-Allow-Origin"], "http://localhost:5173");
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    assert.match(headers["Access-Control-Allow-Methods"], new RegExp(`\\b${method}\\b`));
  }
});
