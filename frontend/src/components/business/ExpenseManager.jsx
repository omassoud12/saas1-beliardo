import { useCallback, useEffect, useState } from "react";
import { deleteBusinessExpense, getBusinessExpenseHistory, getBusinessExpenses, saveBusinessExpense } from "../../lib/businessSummaryApi";
import { formatCurrency, formatDate } from "../../utils/analytics";
import { classifyExpenseHistory, emptyExpenseForm, expenseFormFromRecord, expensePayload, EXPENSE_CATEGORIES } from "../../utils/expenseForms";
import { AnalyticsError } from "./AnalyticsStates";
import { invalidateBusinessRequestCache } from "../../lib/businessRequestCache";

const recurrenceLabels = { monthly: "Monthly", weekly: "Weekly", yearly: "Yearly", one_time: "One-time" };

function amountLabel(expense) {
  const original = formatCurrency(expense.amount, expense.currency);
  return expense.currency === "LBP" ? `${original} (${formatCurrency(expense.amountUsd)} recorded USD value)` : original;
}

function scheduleLabel(expense) {
  if (expense.recurrence === "one_time") return `Effective ${formatDate(expense.occurrenceDate)}`;
  return `Effective ${formatDate(expense.startDate)}${expense.endDate ? ` through ${formatDate(expense.endDate)}` : ""}`;
}

export function ExpenseManager({ businessDate, analysisQuery, businessId }) {
  const [expenses, setExpenses] = useState([]);
  const [history, setHistory] = useState([]);
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [pagination, setPagination] = useState({ active: null, history: null });
  const [form, setForm] = useState(() => emptyExpenseForm(businessDate));
  const [editingId, setEditingId] = useState(null);
  const [state, setState] = useState({ loading: true, busy: false, error: "", message: "" });
  const load = useCallback(async (signal) => {
    try {
      const [records, historyRecords] = await Promise.all([getBusinessExpenses(activePage, 20, signal), getBusinessExpenseHistory(historyPage, 20, signal)]);
      setExpenses(records.items);
      setHistory(classifyExpenseHistory([...records.items, ...historyRecords.items]).filter((item) => historyRecords.items.some((record) => record.id === item.id)));
      setPagination({ active: records.pagination, history: historyRecords.pagination });
      setState((current) => ({ ...current, loading: false, error: "" }));
    } catch (error) {
      if (error.name !== "AbortError") setState((current) => ({ ...current, loading: false, error: error.message || "Unable to load expenses" }));
    }
  }, [activePage, historyPage]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => { setEditingId(null); setForm(emptyExpenseForm(businessDate)); };
  const submit = async (event) => {
    event.preventDefault();
    if (state.busy) return;
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    try {
      await saveBusinessExpense(expensePayload(form), editingId);
      await load();
      invalidateBusinessRequestCache(businessId);
      analysisQuery.retry();
      setState((current) => ({ ...current, busy: false, message: editingId ? "Expense updated; its previous version remains in history." : "Expense created." }));
      reset();
    } catch (error) { setState((current) => ({ ...current, busy: false, error: error.message || "Unable to save expense" })); }
  };
  const deactivate = async (expense) => {
    if (state.busy || !window.confirm(`Deactivate ${expense.name}? Its recorded history will remain available.`)) return;
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    try {
      await deleteBusinessExpense(expense.id);
      await load();
      invalidateBusinessRequestCache(businessId);
      analysisQuery.retry();
      if (editingId === expense.id) reset();
      setState((current) => ({ ...current, busy: false, message: "Expense deactivated; history was preserved." }));
    } catch (error) { setState((current) => ({ ...current, busy: false, error: error.message || "Unable to deactivate expense" })); }
  };
  const breakdown = analysisQuery.data?.expenses?.breakdown ?? [];
  const archived = history.filter((item) => item.validTo);

  return <div className="business-view business-management-grid">
    <section className="analytics-panel business-form-panel" aria-labelledby="expense-form-title">
      <div className="analytics-panel__heading"><div><p className="eyebrow">Expense manager · إدارة المصاريف</p><h3 id="expense-form-title">{editingId ? "Edit expense · تعديل المصروف" : "Add expense · إضافة مصروف"}</h3></div><p>Record the amount and schedule actually used by the business.</p></div>
      <form className="business-data-form" onSubmit={submit}>
        <label className="business-form-wide"><span>Expense name · اسم المصروف</span><input required maxLength="100" value={form.name} onChange={(event) => change("name", event.target.value)} /></label>
        <label><span>Category · الفئة</span><select value={form.category} onChange={(event) => change("category", event.target.value)}>{Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Recurrence · التكرار</span><select value={form.recurrence} onChange={(event) => change("recurrence", event.target.value)}>{Object.entries(recurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Amount · المبلغ</span><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => change("amount", event.target.value)} /></label>
        <label><span>Currency · العملة</span><select value={form.currency} onChange={(event) => change("currency", event.target.value)}><option value="USD">USD</option><option value="LBP">LBP</option></select></label>
        {form.currency === "LBP" && <label className="business-form-wide"><span>LBP per USD exchange rate · سعر الصرف</span><input required min="0.000001" step="0.000001" type="number" value={form.exchangeRateToUsd} onChange={(event) => change("exchangeRateToUsd", event.target.value)} /><small>Stored with this expense so historical profit stays consistent.</small></label>}
        {form.recurrence === "one_time" ? <label><span>Effective date · تاريخ النفاذ</span><input required type="date" value={form.occurrenceDate} onChange={(event) => change("occurrenceDate", event.target.value)} /></label> : <>
          <label><span>Effective date · تاريخ البدء</span><input required type="date" value={form.startDate} onChange={(event) => change("startDate", event.target.value)} /></label>
          <label><span>End date (optional) · تاريخ الانتهاء</span><input type="date" min={form.startDate} value={form.endDate} onChange={(event) => change("endDate", event.target.value)} /></label>
        </>}
        <label className="business-form-wide"><span>Notes (optional) · ملاحظات</span><textarea maxLength="500" rows="3" value={form.notes} onChange={(event) => change("notes", event.target.value)} /></label>
        <label className="business-check business-form-wide"><input type="checkbox" checked={form.includeInProfit} onChange={(event) => change("includeInProfit", event.target.checked)} /><span>Include this expense in profit · احتساب المصروف ضمن الربح</span></label>
        {state.error && <p className="business-form-message business-form-message--error" role="alert">{state.error}</p>}
        {state.message && <p className="business-form-message" role="status">{state.message}</p>}
        <div className="business-form-actions business-form-wide">{editingId && <button className="button button--secondary" type="button" onClick={reset}>Cancel</button>}<button className="button button--primary" disabled={state.busy}>{state.busy ? "Saving..." : editingId ? "Save changes" : "Add expense"}</button></div>
      </form>
    </section>
    <section className="analytics-panel" aria-labelledby="expense-list-title">
      <div className="analytics-panel__heading"><div><p className="eyebrow">Selected-period costs · مصاريف الفترة</p><h3 id="expense-list-title">Expense records · سجلات المصاريف</h3></div><p>{analysisQuery.loading ? "Calculating costs..." : analysisQuery.error ? "Cost analysis unavailable" : `Expenses for this period: ${formatCurrency(analysisQuery.data.financial.totalCosts)}`}</p></div>
      {analysisQuery.error && <AnalyticsError onRetry={analysisQuery.retry} />}
      {!analysisQuery.error && breakdown.length > 0 && <div className="expense-breakdown">{breakdown.map((item) => <span key={item.category}>{EXPENSE_CATEGORIES[item.category] ?? item.category}<strong>{formatCurrency(item.amount)}</strong></span>)}</div>}
      {state.loading ? <p className="business-empty-copy">Loading expenses...</p> : expenses.length === 0 ? <p className="business-empty-copy">No active expenses.</p> : <div className="business-record-list">{expenses.map((expense) => <article key={expense.id}><div><strong>{expense.name} <em className={`expense-status ${expense.supersedesExpenseId ? "expense-status--changed" : ""}`}>{expense.supersedesExpenseId ? "Active · changed" : "Active"}</em></strong><span>{amountLabel(expense)} · {recurrenceLabels[expense.recurrence]}</span><small>{scheduleLabel(expense)} · {EXPENSE_CATEGORIES[expense.category] ?? expense.category}</small>{!expense.includeInProfit && <small className="record-note">Excluded from profit</small>}{expense.notes && <small>{expense.notes}</small>}</div><div><button type="button" className="button button--secondary" onClick={() => { setEditingId(expense.id); setForm(expenseFormFromRecord(expense)); }}>Edit</button><button type="button" className="button button--danger" onClick={() => deactivate(expense)} disabled={state.busy}>Deactivate</button></div></article>)}</div>}
      <PaginationControls pagination={pagination.active} count={expenses.length} onPageChange={setActivePage} />
      {archived.length > 0 && <details className="expense-history"><summary>Expense history · {pagination.history?.total ?? archived.length} total records</summary><div className="business-record-list">{archived.map((expense) => <article key={expense.id}><div><strong>{expense.name} <em className={`expense-status expense-status--${expense.historyStatus}`}>{expense.historyStatus === "changed" ? "Previous version" : "Inactive"}</em></strong><span>{amountLabel(expense)} · {recurrenceLabels[expense.recurrence]}</span><small>{scheduleLabel(expense)} · record closed {formatDate(expense.validTo)}</small>{expense.notes && <small>{expense.notes}</small>}</div></article>)}</div><PaginationControls pagination={pagination.history} count={history.length} onPageChange={setHistoryPage} /></details>}
    </section>
  </div>;
}

function PaginationControls({ pagination, count, onPageChange }) {
  if (!pagination || pagination.total <= pagination.pageSize) return null;
  const from = (pagination.page - 1) * pagination.pageSize + 1;
  return <div className="record-pagination"><button className="button button--secondary" type="button" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Previous</button><span>Showing {from}–{from + count - 1} of {pagination.total}</span><button className="button button--secondary" type="button" disabled={!pagination.hasMore} onClick={() => onPageChange(pagination.page + 1)}>Next</button></div>;
}
