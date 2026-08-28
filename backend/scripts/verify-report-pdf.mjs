import puppeteer from "puppeteer";
import { createPdfRenderer } from "../src/features/business/business-report.pdf.js";
import { createReportDocument } from "../src/features/business/business-report.template.js";

const executablePath = process.argv[2] || process.env.PUPPETEER_EXECUTABLE_PATH;
const renderer = createPdfRenderer({
  launch: (options) => puppeteer.launch({ ...options, ...(executablePath ? { executablePath } : {}) }),
  timeoutMs: 30_000,
});
const activities = [
  { type: "playstation", label: "PlayStation", sessions: 8, totalSeconds: 14400, revenue: 48 },
  { type: "billiard", label: "Billiard", sessions: 5, totalSeconds: 10800, revenue: 30 },
  { type: "pingpong", label: "Ping Pong", sessions: 3, totalSeconds: 5400, revenue: 15 },
];
const document = createReportDocument({
  reportType: "monthly", year: 2026, month: 8, title: "PDF Verification Report",
  notes: "English · العربية", language: "ar", business: { name: "Beliardo Test Lounge" },
  timezone: "Asia/Beirut", generatedAt: new Date(),
  sections: { summary: true, charts: true, categoryBreakdown: true, detailsTable: true },
  summary: {
    period: { kind: "month", year: 2026, month: 8, currency: "USD", timezone: "Asia/Beirut" },
    metrics: { sessionCount: 16, totalSeconds: 30600, revenue: 93 }, activities,
    days: Array.from({ length: 31 }, (_, index) => ({
      key: `2026-08-${String(index + 1).padStart(2, "0")}`,
      total: { sessions: index % 4, totalSeconds: (index % 4) * 1800, revenue: (index % 4) * 6 },
      activities: [],
    })),
  },
});
const bytes = await renderer(document).catch((error) => { throw error.cause ?? error; });
const buffer = Buffer.from(bytes);
if (buffer.subarray(0, 4).toString() !== "%PDF" || buffer.length < 1_000) {
  throw new Error("Puppeteer returned an invalid PDF");
}
console.log(`Verified in-memory PDF (${buffer.length} bytes)`);
