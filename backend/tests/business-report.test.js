import test from "node:test";
import assert from "node:assert/strict";
import { createBusinessReportService, quotaMonthAt } from "../src/features/business/business-report.service.js";
import { createReportGenerationGate } from "../src/features/business/business-report.concurrency.js";
import { createPdfRenderer } from "../src/features/business/business-report.pdf.js";
import { createReportDocument, escapeHtml } from "../src/features/business/business-report.template.js";

function summary() {
  return {
    period: { kind: "month", year: 2026, month: 8, businessDate: "2026-08-27", timezone: "Asia/Beirut", currency: "USD" },
    metrics: { trackedDays: 1, sessionCount: 2, totalHours: 1.5, totalSeconds: 5400, revenue: 18 },
    activities: [
      { type: "playstation", label: "PlayStation", sessions: 1, totalSeconds: 3600, hours: 1, revenue: 12 },
      { type: "billiard", label: "Billiard", sessions: 1, totalSeconds: 1800, hours: 0.5, revenue: 6 },
      { type: "pingpong", label: "Ping Pong", sessions: 0, totalSeconds: 0, hours: 0, revenue: 0 },
    ],
    days: [{
      key: "2026-08-01",
      total: { sessions: 2, totalSeconds: 5400, revenue: 18 },
      activities: [
        { type: "playstation", sessions: 1, totalSeconds: 3600, revenue: 12 },
        { type: "billiard", sessions: 1, totalSeconds: 1800, revenue: 6 },
        { type: "pingpong", sessions: 0, totalSeconds: 0, revenue: 0 },
      ],
    }],
  };
}

test("report service uses only the authenticated tenant id and authoritative summary service", async () => {
  const calls = [];
  const exportCalls = [];
  const service = createBusinessReportService({
    repository: { async findBusiness(businessId) { calls.push(["business", businessId]); return { id: businessId, name: "Tenant Lounge" }; } },
    summaries: { async monthly(values) { calls.push(["summary", values.businessId]); return summary(); } },
    exports: {
      async reserve(values) { exportCalls.push(["reserve", values.businessId, values.requestedBy]); return { outcome: "reserved", exportId: "report-1", used: 0, remaining: 5 }; },
      async upload(path, buffer) { exportCalls.push(["upload", path, buffer.length]); },
      async complete(values) { exportCalls.push(["complete", values.exportId]); },
      async fail() { throw new Error("fail should not be called"); },
      async remove() { throw new Error("remove should not be called"); },
    },
    pdf: async ({ html }) => { assert.match(html, /Tenant Lounge/); return new TextEncoder().encode("%PDF-1.4"); },
    clock: () => new Date("2026-08-27T10:00:00.000Z"),
  });
  const result = await service.generate({
    businessId: "tenant-a", userId: "owner-a", timezone: "Asia/Beirut",
    config: { reportType: "monthly", year: 2026, month: 8, title: "August", notes: "", language: "en", sections: { summary: true, charts: true, categoryBreakdown: true, detailsTable: true } },
  });
  assert.deepEqual(calls, [["business", "tenant-a"], ["summary", "tenant-a"]]);
  assert.deepEqual(exportCalls, [
    ["reserve", "tenant-a", "owner-a"],
    ["upload", "tenant-a/2026-08/report-1.pdf", 8],
    ["complete", "report-1"],
  ]);
  assert.equal(result.filename, "business-report-monthly-2026-08.pdf");
  assert.equal(result.buffer.subarray(0, 4).toString(), "%PDF");
  assert.deepEqual(result.quota, { limit: 6, used: 1, remaining: 5 });
});

test("report quota uses the business timezone calendar month", () => {
  const instant = new Date("2026-08-31T21:30:00.000Z");
  assert.equal(quotaMonthAt(instant, "Asia/Beirut"), "2026-09-01");
  assert.equal(quotaMonthAt(instant, "UTC"), "2026-08-01");
});

test("quota exhaustion skips summary and PDF generation", async () => {
  let generated = false;
  const service = createBusinessReportService({
    exports: { async reserve() { return { outcome: "quota_exceeded", used: 6, remaining: 0 }; } },
    pdf: async () => { generated = true; },
  });
  await assert.rejects(
    service.generate({ businessId: "tenant-a", userId: "owner-a", timezone: "UTC", config: { reportType: "yearly", year: 2026 } }),
    (error) => error.code === "REPORT_QUOTA_EXCEEDED" && error.details.remaining === 0,
  );
  assert.equal(generated, false);
});

test("failed PDF generation releases its reservation without consuming quota", async () => {
  const calls = [];
  const service = createBusinessReportService({
    repository: { async findBusiness() { return { id: "tenant-a", name: "Tenant Lounge" }; } },
    summaries: { async monthly() { return summary(); } },
    exports: {
      async reserve() { return { outcome: "reserved", exportId: "report-2", used: 2, remaining: 3 }; },
      async fail(values) { calls.push([values.exportId, values.failureCode]); },
      async remove() {},
    },
    pdf: async () => { const error = new Error("render failed"); error.code = "RENDER_FAILED"; throw error; },
  });
  await assert.rejects(service.generate({
    businessId: "tenant-a", userId: "owner-a", timezone: "UTC",
    config: { reportType: "monthly", year: 2026, month: 8, title: "August", notes: "", sections: { summary: true, charts: true, categoryBreakdown: true, detailsTable: true }, language: "en" },
  }), /render failed/);
  assert.deepEqual(calls, [["report-2", "RENDER_FAILED"]]);
});

test("generation gate rejects excess concurrent Chromium work", async () => {
  const gate = createReportGenerationGate(1);
  let release;
  const first = gate.run(() => new Promise((resolve) => { release = resolve; }));
  await assert.rejects(gate.run(async () => {}), (error) => error.code === "REPORT_GENERATION_BUSY");
  release();
  await first;
  await gate.run(async () => {});
});

test("saved reports can be listed and downloaded without consuming quota", async () => {
  const service = createBusinessReportService({
    exports: {
      async getStatus() {
        return { used: 2, reports: [{ id: "report-3", filename: "saved.pdf", storagePath: "private/report-3.pdf" }] };
      },
      async findCompleted(businessId, reportId) {
        assert.deepEqual([businessId, reportId], ["tenant-a", "report-3"]);
        return { filename: "saved.pdf", storagePath: "private/report-3.pdf" };
      },
      async download(path) {
        assert.equal(path, "private/report-3.pdf");
        return Buffer.from("%PDF");
      },
    },
    clock: () => new Date("2026-08-27T10:00:00.000Z"),
  });
  const listing = await service.list({ businessId: "tenant-a", timezone: "UTC" });
  assert.deepEqual(listing.quota, { limit: 6, used: 2, remaining: 4, month: "2026-08-01" });
  assert.equal("storagePath" in listing.reports[0], false);
  const downloaded = await service.download({ businessId: "tenant-a", reportId: "report-3" });
  assert.equal(downloaded.filename, "saved.pdf");
  assert.equal(downloaded.buffer.toString(), "%PDF");
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

test("report charts and daily details match the current analytics views", () => {
  const common = {
    title: "Aligned report", notes: "", language: "en", business: { name: "Beliardo" },
    timezone: "Asia/Beirut", generatedAt: new Date("2026-08-27T10:00:00.000Z"),
    sections: { summary: true, charts: true, categoryBreakdown: true, detailsTable: true },
  };
  const monthly = createReportDocument({ ...common, reportType: "monthly", summary: summary() });
  assert.match(monthly.html, /Revenue by day/);
  assert.match(monthly.html, /Daily session volume/);
  assert.match(monthly.html, /#43bfa5/);
  assert.match(monthly.html, /#e5795c/);
  assert.match(monthly.html, /#d9a83f/);

  const activities = summary().activities;
  const daily = createReportDocument({
    ...common,
    reportType: "daily",
    summary: {
      period: {
        kind: "day", date: "2026-08-27", businessDate: "2026-08-27", timezone: "Asia/Beirut", currency: "USD",
        from: "2026-08-27T03:00:00.000Z", to: "2026-08-28T03:00:00.000Z",
      },
      metrics: { completedSessions: 1, totalSeconds: 3600, revenue: 12 },
      activities,
      traffic: [],
      concurrencySessions: [{ activity: "playstation", status: "completed", startedAt: "2026-08-27T04:00:00.000Z", endedAt: "2026-08-27T05:00:00.000Z" }],
      sessions: [{
        id: "session-1", activity: "playstation", activityLabel: "PlayStation", stationNumber: 4,
        controllerCount: 3, status: "completed", startedAt: "2026-08-27T04:00:00.000Z",
        endedAt: "2026-08-27T05:00:00.000Z", durationSeconds: 3600, revenue: 12,
      }],
    },
  });
  assert.match(daily.html, /Active sessions by hour/);
  assert.match(daily.html, /Business day 06:00–06:00/);
  assert.match(daily.html, /Controllers/);
  assert.match(daily.html, /<td>3<\/td>/);

  const yearly = createReportDocument({
    ...common,
    reportType: "yearly",
    summary: {
      period: { kind: "year", year: 2026, businessDate: "2026-08-27", timezone: "Asia/Beirut", currency: "USD" },
      metrics: { sessionCount: 2, totalSeconds: 5400, revenue: 18 },
      activities,
      months: Array.from({ length: 12 }, (_, index) => ({
        key: `2026-${String(index + 1).padStart(2, "0")}`,
        total: index === 0 ? { sessions: 2, totalSeconds: 5400, revenue: 18 } : { sessions: 0, totalSeconds: 0, revenue: 0 },
        activities: index === 0 ? summary().days[0].activities : [],
      })),
    },
  });
  assert.match(yearly.html, /Monthly revenue by activity/);
  assert.match(yearly.html, /stacked-chart/);
  assert.match(yearly.html, /future-mark/);
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
