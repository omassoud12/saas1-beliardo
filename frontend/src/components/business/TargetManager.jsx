import { useCallback, useEffect, useState } from "react";
import { deleteBusinessTarget, getBusinessTargets, saveBusinessTarget } from "../../lib/businessSummaryApi";
import { formatCurrency } from "../../utils/analytics";

const initialForm = (date) => ({
  monthlyTotalTarget: "", targetMonth: date.slice(0, 7),
});

function monthLabel(date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date.slice(0, 7)}-01T12:00:00Z`));
}

export function TargetManager({ businessDate, analysisQuery }) {
  const [targets, setTargets] = useState([]);
  const [form, setForm] = useState(() => initialForm(businessDate));
  const [editingId, setEditingId] = useState(null);
  const [state, setState] = useState({ loading: true, busy: false, error: "", message: "" });
  const load = useCallback(async (signal) => {
    try { setTargets(await getBusinessTargets(signal)); setState((current) => ({ ...current, loading: false, error: "" })); }
    catch (error) { if (error.name !== "AbortError") setState((current) => ({ ...current, loading: false, error: error.message || "Unable to load targets" })); }
  }, []);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const reset = () => { setEditingId(null); setForm(initialForm(businessDate)); };
  const submit = async (event) => {
    event.preventDefault();
    if (state.busy) return;
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    try {
      await saveBusinessTarget({ monthlyTotalTarget: Number(form.monthlyTotalTarget), effectiveFrom: `${form.targetMonth}-01` }, editingId);
      await load();
      analysisQuery.retry();
      setState((current) => ({ ...current, busy: false, message: editingId ? "Target updated." : "Target created." }));
      reset();
    } catch (error) { setState((current) => ({ ...current, busy: false, error: error.message || "Unable to create target" })); }
  };
  const remove = async (target) => {
    if (state.busy || !window.confirm(`Delete the ${monthLabel(target.effectiveFrom)} target?`)) return;
    setState((current) => ({ ...current, busy: true, error: "", message: "" }));
    try {
      await deleteBusinessTarget(target.id);
      await load();
      analysisQuery.retry();
      if (editingId === target.id) reset();
      setState((current) => ({ ...current, busy: false, message: "Target deleted." }));
    } catch (error) { setState((current) => ({ ...current, busy: false, error: error.message || "Unable to delete target" })); }
  };
  const selectedTarget = analysisQuery.data?.comparisons?.target?.values;
  return <div className="business-view business-management-grid">
    <section className="analytics-panel business-form-panel" aria-labelledby="target-form-title">
      <div className="analytics-panel__heading"><div><p className="eyebrow">Monthly sales goal · هدف المبيعات الشهري</p><h3 id="target-form-title">{editingId ? "Edit target · تعديل الهدف" : "Add target · إضافة هدف"}</h3></div><p>Enter costs plus desired profit as one total.<br /><span lang="ar" dir="rtl">أدخل المصاريف والربح المطلوب كمجموع واحد.</span></p></div>
      <form className="business-data-form" onSubmit={submit}>
        <label><span>Monthly sales target (USD) · هدف المبيعات</span><input required min="0.01" step="0.01" type="number" placeholder="Costs + desired profit" value={form.monthlyTotalTarget} onChange={(event) => change("monthlyTotalTarget", event.target.value)} /></label>
        <label><span>Target month · شهر الهدف</span><input required type="month" value={form.targetMonth} onChange={(event) => change("targetMonth", event.target.value)} /></label>
        {state.error && <p className="business-form-message business-form-message--error" role="alert">{state.error}</p>}
        {state.message && <p className="business-form-message" role="status">{state.message}</p>}
        <div className="business-form-actions business-form-wide">{editingId && <button className="button button--secondary" type="button" onClick={reset}>Cancel · إلغاء</button>}<button className="button button--primary" disabled={state.busy}>{state.busy ? "Saving..." : editingId ? "Save changes · حفظ" : "Create target · إنشاء"}</button></div>
      </form>
    </section>
    <section className="analytics-panel" aria-labelledby="target-history-title">
      <div className="analytics-panel__heading"><div><p className="eyebrow">Selected-period target · هدف الفترة</p><h3 id="target-history-title">Targets · الأهداف</h3></div><p>{selectedTarget ? `Sales ${formatCurrency(selectedTarget.revenue)} · Expected profit ${formatCurrency(selectedTarget.netProfit)}` : "No target configured · لا يوجد هدف"}</p></div>
      {state.loading ? <p className="business-empty-copy">Loading targets...</p> : targets.length === 0 ? <p className="business-empty-copy">No targets have been added yet · لا توجد أهداف بعد</p> : <div className="business-record-list">{targets.map((target) => <article key={target.id}><div><strong>{monthLabel(target.effectiveFrom)}</strong><span>Sales target · هدف المبيعات: {formatCurrency(target.monthlyRevenueTargetUsd)}</span><small>Recorded costs · المصاريف: {formatCurrency(target.recordedCostsUsd ?? target.monthlyRevenueTargetUsd - target.monthlyProfitTargetUsd)} · Expected profit · الربح المتوقع: {formatCurrency(target.calculatedProfitUsd ?? target.monthlyProfitTargetUsd)}</small>{target.costBasisChanged && <small className="record-note">Updated from current expenses · محسوب حسب المصاريف الحالية</small>}</div><div><button type="button" className="button button--secondary" onClick={() => { setEditingId(target.id); setForm({ monthlyTotalTarget: String(target.monthlyRevenueTargetUsd), targetMonth: target.effectiveFrom.slice(0, 7) }); }}>Edit · تعديل</button><button type="button" className="button button--danger" onClick={() => remove(target)} disabled={state.busy}>Delete · حذف</button></div></article>)}</div>}
    </section>
  </div>;
}
