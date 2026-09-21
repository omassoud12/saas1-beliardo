export const EXPENSE_CATEGORIES = {
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  EMPLOYEES: "Employees",
  OTHER: "Other expense",
};

export function emptyExpenseForm(date) {
  return {
    name: "Rent", category: "RENT", amount: "", currency: "USD", exchangeRateToUsd: "1",
    recurrence: "monthly", occurrenceDate: date, startDate: date, endDate: "", notes: "", includeInProfit: true,
  };
}

export function expenseFormFromRecord(expense) {
  return {
    name: expense.name,
    category: expense.category,
    amount: String(expense.amount),
    currency: expense.currency,
    exchangeRateToUsd: String(expense.exchangeRateToUsd),
    recurrence: expense.recurrence,
    occurrenceDate: expense.occurrenceDate ?? expense.startDate,
    startDate: expense.startDate,
    endDate: expense.endDate ?? "",
    notes: expense.notes ?? "",
    includeInProfit: expense.includeInProfit !== false,
  };
}

export function expensePayload(form) {
  const oneTime = form.recurrence === "one_time";
  return {
    name: form.name.trim(),
    category: form.category,
    amount: Number(form.amount),
    currency: form.currency,
    exchangeRateToUsd: form.currency === "USD" ? 1 : Number(form.exchangeRateToUsd),
    recurrence: form.recurrence,
    occurrenceDate: oneTime ? form.occurrenceDate : null,
    startDate: oneTime ? form.occurrenceDate : form.startDate,
    endDate: oneTime ? null : (form.endDate || null),
    notes: form.notes.trim(),
    includeInProfit: form.includeInProfit,
  };
}

export function classifyExpenseHistory(records) {
  const supersededIds = new Set(records.map((item) => item.supersedesExpenseId).filter(Boolean));
  return records.map((item) => ({
    ...item,
    historyStatus: item.historyStatus ?? (item.validTo
      ? (supersededIds.has(item.id) ? "changed" : "inactive")
      : "active"),
  }));
}
