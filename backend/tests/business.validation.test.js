import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDailySummary, validateMonthlySummary, validateYearlySummary,
} from "../src/features/business/business.validation.js";

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
