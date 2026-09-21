import test from "node:test";
import assert from "node:assert/strict";
import { classifyExpenseHistory, expenseFormFromRecord, expensePayload } from "../src/utils/expenseForms.js";

function record(overrides = {}) {
  return {
    id: "current", name: "Annual license", category: "OTHER", amount: 895000,
    currency: "LBP", exchangeRateToUsd: 89500, recurrence: "yearly",
    occurrenceDate: null, startDate: "2024-03-17", endDate: null,
    notes: "Renewal", includeInProfit: false, validTo: null, supersedesExpenseId: "old",
    ...overrides,
  };
}

test("editing preserves legacy recurrence, original currency, dates, notes and profit flag", () => {
  const form = expenseFormFromRecord(record());
  form.notes = "Updated note";
  assert.deepEqual(expensePayload(form), {
    name: "Annual license", category: "OTHER", amount: 895000, currency: "LBP",
    exchangeRateToUsd: 89500, recurrence: "yearly", occurrenceDate: null,
    startDate: "2024-03-17", endDate: null, notes: "Updated note", includeInProfit: false,
  });
});

test("one-time edits preserve occurrence semantics and do not submit a recurrence end date", () => {
  const form = expenseFormFromRecord(record({ recurrence: "one_time", occurrenceDate: "2025-05-06", startDate: "2025-05-06", endDate: null }));
  const payload = expensePayload(form);
  assert.equal(payload.recurrence, "one_time");
  assert.equal(payload.occurrenceDate, "2025-05-06");
  assert.equal(payload.startDate, "2025-05-06");
  assert.equal(payload.endDate, null);
});

test("history distinguishes replaced versions from deactivated records", () => {
  const history = classifyExpenseHistory([
    record(),
    record({ id: "old", validTo: "2026-01-01", supersedesExpenseId: null }),
    record({ id: "deleted", validTo: "2026-02-01", supersedesExpenseId: null }),
  ]);
  assert.deepEqual(history.map((item) => item.historyStatus), ["active", "changed", "inactive"]);
});
