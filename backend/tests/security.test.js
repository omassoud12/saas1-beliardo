import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createApiRateLimiter, createPdfGenerationRateLimiter } from "../src/middleware/security.js";

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("global API limiter returns the standard API error shape", async () => {
  const app = express();
  app.set("trust proxy", 0);
  app.use(createApiRateLimiter({ limit: 2 }));
  app.get("/resource", (_request, response) => response.json({ ok: true }));

  await withServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/resource`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/resource`)).status, 200);
    const blocked = await fetch(`${baseUrl}/resource`);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error.code, "API_RATE_LIMITED");
    assert.match(blocked.headers.get("ratelimit-policy") ?? "", /api/);
  });
});

test("PDF generation limiter isolates quotas by authenticated business", async () => {
  const app = express();
  app.use((request, _response, next) => {
    request.auth = { businessId: request.headers["x-business-id"] };
    next();
  });
  app.use(createPdfGenerationRateLimiter({ limit: 1 }));
  app.get("/pdf", (_request, response) => response.json({ ok: true }));

  await withServer(app, async (baseUrl) => {
    const tenantA = { headers: { "X-Business-Id": "tenant-a" } };
    assert.equal((await fetch(`${baseUrl}/pdf`, tenantA)).status, 200);
    assert.equal((await fetch(`${baseUrl}/pdf`, tenantA)).status, 429);
    assert.equal((await fetch(`${baseUrl}/pdf`, { headers: { "X-Business-Id": "tenant-b" } })).status, 200);
  });
});
