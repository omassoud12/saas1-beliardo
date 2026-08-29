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
const sections = { summary: true, charts: true, categoryBreakdown: true, detailsTable: true };
const common = {
  title: "PDF Verification Report", notes: "English · العربية", business: { name: "Beliardo Test Lounge" },
  timezone: "Asia/Beirut", generatedAt: new Date(), sections,
};
const metricSet = (sessions = 16, seconds = 30600, revenue = 93) => ({ sessionCount: sessions, completedSessions: sessions, totalSeconds: seconds, revenue });
const bucketActivities = (multiplier) => activities.map((activity, index) => ({
  ...activity,
  sessions: multiplier ? Math.max(0, multiplier - index) : 0,
  totalSeconds: multiplier ? Math.max(0, multiplier - index) * 1800 : 0,
  revenue: multiplier ? Math.max(0, multiplier - index) * (6 - index) : 0,
}));
const bucket = (key, multiplier) => {
  const values = bucketActivities(multiplier);
  return {
    key,
    activities: values,
    total: values.reduce((total, activity) => ({
      sessions: total.sessions + activity.sessions,
      totalSeconds: total.totalSeconds + activity.totalSeconds,
      revenue: total.revenue + activity.revenue,
    }), { sessions: 0, totalSeconds: 0, revenue: 0 }),
  };
};

const reports = [
  {
    ...common, reportType: "daily", language: "en",
    summary: {
      period: { kind: "day", date: "2026-08-27", businessDate: "2026-08-27", currency: "USD", timezone: "Asia/Beirut", from: "2026-08-27T03:00:00Z", to: "2026-08-28T03:00:00Z" },
      metrics: metricSet(3, 10800, 36), activities,
      traffic: [],
      concurrencySessions: [
        { activity: "playstation", status: "completed", startedAt: "2026-08-27T04:00:00Z", endedAt: "2026-08-27T08:00:00Z" },
        { activity: "billiard", status: "completed", startedAt: "2026-08-27T05:00:00Z", endedAt: "2026-08-27T07:30:00Z" },
        { activity: "pingpong", status: "paused", startedAt: "2026-08-27T06:00:00Z", pausedAt: "2026-08-27T09:00:00Z" },
      ],
      sessions: [{ id: "one", activity: "playstation", activityLabel: "PlayStation", stationNumber: 2, controllerCount: 3, status: "completed", startedAt: "2026-08-27T04:00:00Z", endedAt: "2026-08-27T08:00:00Z", durationSeconds: 14400, revenue: 24 }],
    },
  },
  {
    ...common, reportType: "monthly", language: "ar",
    summary: {
      period: { kind: "month", year: 2026, month: 8, businessDate: "2026-08-27", currency: "USD", timezone: "Asia/Beirut" },
      metrics: metricSet(), activities,
      days: Array.from({ length: 31 }, (_, index) => bucket(`2026-08-${String(index + 1).padStart(2, "0")}`, index < 27 ? index % 5 : 0)),
    },
  },
  {
    ...common, reportType: "yearly", language: "en",
    summary: {
      period: { kind: "year", year: 2026, businessDate: "2026-08-27", currency: "USD", timezone: "Asia/Beirut" },
      metrics: metricSet(54, 120000, 720), activities,
      months: Array.from({ length: 12 }, (_, index) => bucket(`2026-${String(index + 1).padStart(2, "0")}`, index < 8 ? index + 2 : 0)),
    },
  },
];

for (const report of reports) {
  const bytes = await renderer(createReportDocument(report)).catch((error) => { throw error.cause ?? error; });
  const buffer = Buffer.from(bytes);
  if (buffer.subarray(0, 4).toString() !== "%PDF" || buffer.length < 1_000) {
    throw new Error(`Puppeteer returned an invalid ${report.reportType} PDF`);
  }
  console.log(`Verified ${report.reportType} PDF (${buffer.length} bytes)`);
}
