import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDailySummary, validateMonthlySummary, validateYearlySummary,
} from "../src/features/business/business.validation.js";
import { validateBusinessReport, validateBusinessReportId } from "../src/features/business/business-report.validation.js";

test("business analytics period validation accepts valid ranges", () => {
  assert.equal(validateDailySummary({ query: { date: "2026-08-24" } }).success, true);
  assert.deepEqual(validateMonthlySummary({ query: { year: "2026", month: "8" } }).data, { year: 2026, month: 8 });
  assert.equal(validateYearlySummary({ query: { year: "2026" } }).success, true);
});

test("business analytics period validation rejects impossible values", () => {
  assert.equal(validateDailySummary({ query: { date: "2026-02-30" } }).success, false);
  assert.equal(validateMonthlySummary({ query: { year: "2026", month: "13" } }).success, false);
  assert.equal(validateYearlySummary({ query: { year: "1900" } }).success, false);
});

test("business PDF validation normalizes safe owner configuration", () => {
  const result = validateBusinessReport({ body: {
    reportType: "monthly", year: 2026, month: 8,
    title: "  August Summary  ", notes: "Owner note",
    sections: { charts: false },
  } });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    reportType: "monthly", year: 2026, month: 8,
    title: "August Summary", notes: "Owner note", language: "en",
    sections: { summary: true, charts: false, categoryBreakdown: true, detailsTable: true },
  });
});

test("business PDF validation rejects invalid periods, oversized text, and empty reports", () => {
  const result = validateBusinessReport({ body: {
    reportType: "daily", date: "2026-02-30", title: "x".repeat(121), notes: "x".repeat(1001),
    sections: { summary: false, charts: false, categoryBreakdown: false, detailsTable: false },
  } });
  assert.equal(result.success, false);
  assert.match(result.errors.join(" "), /valid YYYY-MM-DD/);
  assert.match(result.errors.join(" "), /At least one/);
});

test("saved business report ids require UUIDs", () => {
  assert.equal(validateBusinessReportId({ params: { reportId: "4a9ea7f5-4d40-4c19-87e8-a9ce8a1d9df0" } }).success, true);
  assert.equal(validateBusinessReportId({ params: { reportId: "../report.pdf" } }).success, false);
});
