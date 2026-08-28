import test from "node:test";
import assert from "node:assert/strict";
import { createBusinessReportService } from "../src/features/business/business-report.service.js";
import { createPdfRenderer } from "../src/features/business/business-report.pdf.js";
import { createReportDocument, escapeHtml } from "../src/features/business/business-report.template.js";

function summary() {
  return {
    period: { kind: "month", year: 2026, month: 8, timezone: "Asia/Beirut", currency: "USD" },
    metrics: { trackedDays: 1, sessionCount: 2, totalHours: 1.5, totalSeconds: 5400, revenue: 18 },
    activities: [
      { type: "playstation", label: "PlayStation", sessions: 1, totalSeconds: 3600, hours: 1, revenue: 12 },
      { type: "billiard", label: "Billiard", sessions: 1, totalSeconds: 1800, hours: 0.5, revenue: 6 },
      { type: "pingpong", label: "Ping Pong", sessions: 0, totalSeconds: 0, hours: 0, revenue: 0 },
    ],
    days: [{ key: "2026-08-01", total: { sessions: 2, totalSeconds: 5400, revenue: 18 }, activities: [] }],
  };
}

test("report service uses only the authenticated tenant id and authoritative summary service", async () => {
  const calls = [];
  const service = createBusinessReportService({
    repository: { async findBusiness(businessId) { calls.push(["business", businessId]); return { id: businessId, name: "Tenant Lounge" }; } },
    summaries: { async monthly(values) { calls.push(["summary", values.businessId]); return summary(); } },
    pdf: async ({ html }) => { assert.match(html, /Tenant Lounge/); return new TextEncoder().encode("%PDF-1.4"); },
    clock: () => new Date("2026-08-27T10:00:00.000Z"),
  });
  const result = await service.generate({
    businessId: "tenant-a", timezone: "Asia/Beirut",
    config: { reportType: "monthly", year: 2026, month: 8, title: "August", notes: "", language: "en", sections: { summary: true, charts: true, categoryBreakdown: true, detailsTable: true } },
  });
  assert.deepEqual(calls, [["business", "tenant-a"], ["summary", "tenant-a"]]);
  assert.equal(result.filename, "business-report-monthly-2026-08.pdf");
  assert.equal(result.buffer.subarray(0, 4).toString(), "%PDF");
});

test("report HTML escapes owner content and supports RTL documents", () => {
  assert.equal(escapeHtml(`<script>alert("x")</script>`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  const document = createReportDocument({
    reportType: "monthly", title: `<img src=x onerror=alert(1)>`, notes: `<script>x</script>`, language: "ar",
    business: { name: `<b>Lounge</b>` }, summary: summary(), timezone: "Asia/Beirut",
    generatedAt: new Date("2026-08-27T10:00:00.000Z"),
    sections: { summary: true, charts: false, categoryBreakdown: false, detailsTable: false },
  });
  assert.match(document.html, /dir="rtl"/);
  assert.doesNotMatch(document.html, /<script>x<\/script>/);
  assert.match(document.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("PDF renderer closes its page and browser after success and failure", async () => {
  for (const shouldFail of [false, true]) {
    const closed = { page: 0, browser: 0 };
    const renderer = createPdfRenderer({
      timeoutMs: 1000,
      launch: async () => ({
        async newPage() {
          return {
            setDefaultTimeout() {},
            async setContent() {},
            async evaluate() {},
            async pdf() { if (shouldFail) throw new Error("render failed"); return new Uint8Array([37, 80, 68, 70]); },
            async close() { closed.page += 1; },
          };
        },
        async close() { closed.browser += 1; },
      }),
    });
    if (shouldFail) await assert.rejects(renderer({ html: "<html></html>", footerTemplate: "" }), (error) => error.code === "PDF_GENERATION_FAILED");
    else assert.deepEqual(await renderer({ html: "<html></html>", footerTemplate: "" }), new Uint8Array([37, 80, 68, 70]));
    assert.deepEqual(closed, { page: 1, browser: 1 });
  }
});

test("PDF renderer uses an explicitly resolved browser executable", async () => {
  let receivedOptions;
  const renderer = createPdfRenderer({
    executablePath: "C:/browser/chrome.exe",
    launch: async (options) => {
      receivedOptions = options;
      return {
        async newPage() {
          return {
            setDefaultTimeout() {}, async setContent() {}, async evaluate() {},
            async pdf() { return new Uint8Array([37, 80, 68, 70]); }, async close() {},
          };
        },
        async close() {},
      };
    },
  });
  await renderer({ html: "<html></html>", footerTemplate: "" });
  assert.equal(receivedOptions.executablePath, "C:/browser/chrome.exe");
});

test("PDF renderer aborts a pending Chromium launch when generation times out", async () => {
  let launchAborted = false;
  const renderer = createPdfRenderer({
    timeoutMs: 10,
    launch: ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        launchAborted = true;
        reject(new Error("launch aborted"));
      }, { once: true });
    }),
  });
  await assert.rejects(
    renderer({ html: "<html></html>", footerTemplate: "" }),
    (error) => error.code === "PDF_GENERATION_TIMEOUT",
  );
  assert.equal(launchAborted, true);
});
