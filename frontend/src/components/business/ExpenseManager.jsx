import { useCallback, useEffect, useState } from "react";
import { deleteBusinessExpense, getBusinessExpenses, saveBusinessExpense } from "../../lib/businessSummaryApi";
import { formatCurrency } from "../../utils/analytics";

const expenseNames = {
  RENT: "Rent · إيجار",
  ELECTRICITY: "Electricity · كهرباء",
  EMPLOYEES: "Employees · موظفون",
  OTHER: "Other expense · مصروف آخر",
};

const recurrenceLabels = {
  monthly: "per month · شهرياً", weekly: "per week · أسبوعياً",
  yearly: "per year · سنوياً", one_time: "one-time · مرة واحدة",
};

const emptyForm = (date) => ({
  name: "Rent", category: "RENT", amount: "", startMonth: date.slice(0, 7), endDate: null,
});

function formFromExpense(expense) {
  return {
    name: expense.name, category: expense.category, amount: String(expense.amountUsd),
    startMonth: expense.startDate.slice(0, 7), endDate: expense.endDate,
  };
}

function monthEndDate(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function ExpenseManager({ businessDate, analysisQuery }) {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(() => emptyForm(businessDate));
  const [editingId, setEditingId] = useState(null);
  const [state, setState] = useState({ loading: true, busy: false, error: "", message: "" });
  const load = useCallback(async (signal) => {
    try {
      const records = await getBusinessExpenses(signal);
      setExpenses(records);
      setState((current) => ({ ...current, loading: false, error: "" }));
    } catch (error) {
      if (error.name !== "AbortError") setState((current) => ({ ...current, loading: false, error: error.message || "Unable to load expenses" }));
    }
  }, []);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => { setEditingId(null); setForm(emptyForm(businessDate)); };
  const submit = async (event) => {
    event.preventDefault();
    if (state.busy) return;
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    try {
      await saveBusinessExpense({
        name: form.name || expenseNames[form.category],
        category: form.category,
        amount: Number(form.amount),
        currency: "USD",
        exchangeRateToUsd: 1,
        recurrence: "monthly",
        occurrenceDate: null,
        startDate: `${form.startMonth}-01`,
        endDate: form.endDate,
        notes: "",
        includeInProfit: true,
      }, editingId);
      await load();
      analysisQuery.retry();
      setState((current) => ({ ...current, busy: false, message: editingId ? "Expense updated." : "Expense created." }));
      reset();
    } catch (error) { setState((current) => ({ ...current, busy: false, error: error.message || "Unable to save expense" })); }
  };
  const remove = async (expense) => {
    if (state.busy || !window.confirm(`Delete ${expense.name}?`)) return;
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    try {
      await deleteBusinessExpense(expense.id);
      await load();
      analysisQuery.retry();
      if (editingId === expense.id) reset();
      setState((current) => ({ ...current, busy: false, message: "Expense deleted." }));
    } catch (error) { setState((current) => ({ ...current, busy: false, error: error.message || "Unable to delete expense" })); }
  };
  const stop = async (expense) => {
    const month = businessDate.slice(0, 7);
    if (state.busy || !window.confirm(`Stop ${expense.name} after ${month}? Its earlier cost history will be preserved.`)) return;
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    try {
      await saveBusinessExpense({
        name: expense.name, category: expense.category, amount: expense.amount,
        currency: expense.currency, exchangeRateToUsd: expense.exchangeRateToUsd,
        recurrence: expense.recurrence, occurrenceDate: expense.occurrenceDate,
        startDate: expense.startDate, endDate: monthEndDate(month), notes: expense.notes,
        includeInProfit: expense.includeInProfit,
      }, expense.id);
      await load();
      analysisQuery.retry();
      if (editingId === expense.id) reset();
      setState((current) => ({ ...current, busy: false, message: "Expense stopped after the current month; history was preserved." }));
    } catch (error) { setState((current) => ({ ...current, busy: false, error: error.message || "Unable to stop expense" })); }
  };
  const breakdown = analysisQuery.data?.expenses?.breakdown ?? [];
  return <div className="business-view business-management-grid">
    <section className="analytics-panel business-form-panel" aria-labelledby="expense-form-title">
      <div className="analytics-panel__heading"><div><p className="eyebrow">Monthly costs · المصاريف الشهرية</p><h3 id="expense-form-title">{editingId ? "Edit expense · تعديل المصروف" : "Add expense · إضافة مصروف"}</h3></div><p>The cost is divided across the actual days in each month.<br /><span lang="ar" dir="rtl">يتم توزيع التكلفة على عدد أيام الشهر الفعلي.</span></p></div>
      <form className="business-data-form" onSubmit={submit}>
        <label><span>Expense type · نوع المصروف</span><select value={form.category} onChange={(event) => { const category = event.target.value; setForm((current) => ({ ...current, category, name: expenseNames[category].split(" · ")[0] })); }}>{Object.entries(expenseNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Monthly cost (USD) · التكلفة الشهرية</span><input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => change("amount", event.target.value)} /></label>
        <label><span>Starts in month · يبدأ في شهر</span><input required type="month" value={form.startMonth} onChange={(event) => change("startMonth", event.target.value)} /></label>
        {state.error && <p className="business-form-message business-form-message--error" role="alert">{state.error}</p>}
        {state.message && <p className="business-form-message" role="status">{state.message}</p>}
        <div className="business-form-actions business-form-wide">{editingId && <button className="button button--secondary" type="button" onClick={reset}>Cancel · إلغاء</button>}<button className="button button--primary" disabled={state.busy}>{state.busy ? "Saving..." : editingId ? "Save changes · حفظ" : "Add expense · إضافة"}</button></div>
      </form>
    </section>
    <section className="analytics-panel" aria-labelledby="expense-list-title">
      <div className="analytics-panel__heading"><div><p className="eyebrow">Selected-period costs · مصاريف الفترة</p><h3 id="expense-list-title">Expenses · المصاريف</h3></div><p>{analysisQuery.loading ? "Calculating costs..." : `Total included costs · الإجمالي: ${formatCurrency(analysisQuery.data?.financial.totalCosts ?? 0)}`}</p></div>
      {breakdown.length > 0 && <div className="expense-breakdown">{breakdown.map((item) => <span key={item.category}>{expenseNames[item.category] ?? item.category}<strong>{formatCurrency(item.amount)}</strong></span>)}</div>}
      {state.loading ? <p className="business-empty-copy">Loading expenses...</p> : expenses.length === 0 ? <p className="business-empty-copy">No expenses have been added yet · لا توجد مصاريف بعد</p> : <div className="business-record-list">{expenses.map((expense) => <article key={expense.id}><div><strong>{expense.name}</strong><span>{formatCurrency(expense.amountUsd)} {recurrenceLabels[expense.recurrence] ?? expense.recurrence}</span><small>{expense.recurrence === "one_time" ? `Date · التاريخ: ${expense.occurrenceDate}` : `Starts · يبدأ: ${expense.startDate.slice(0, 7)}${expense.endDate ? ` · Ends · ينتهي: ${expense.endDate.slice(0, 7)}` : ""}`}</small>{expense.recurrence !== "monthly" && <small className="record-note">Legacy schedule · سيتم تحويله إلى شهري عند التعديل</small>}</div><div>{expense.recurrence === "monthly" && !expense.endDate && expense.startDate.slice(0, 7) <= businessDate.slice(0, 7) && <button type="button" className="button button--secondary" onClick={() => stop(expense)} disabled={state.busy}>Stop · إيقاف</button>}<button type="button" className="button button--secondary" onClick={() => { setEditingId(expense.id); setForm(formFromExpense(expense)); }}>Edit · تعديل</button><button type="button" className="button button--danger" onClick={() => remove(expense)} disabled={state.busy}>Delete · حذف</button></div></article>)}</div>}
    </section>
  </div>;
}
