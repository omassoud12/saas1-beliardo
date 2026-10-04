import { useCallback, useEffect, useRef, useState } from "react";
import { confirmHistoricalImport, getHistoricalImports, previewHistoricalImport } from "../../lib/businessSummaryApi";
import { invalidateBusinessRequestCache } from "../../lib/businessRequestCache";
import { formatCurrency, formatDate } from "../../utils/analytics";

const MAX_FILE_BYTES = 256 * 1024;
const activityLabels = { playstation: "PlayStation", billiard: "Billiard", pingpong: "Ping Pong" };
const emptyManualRecord = {
  businessDate: "", revenue: "", currency: "USD", exchangeRate: "", activity: "",
  expenses: "", expenseCurrency: "USD", expenseExchangeRate: "",
  completedSessions: "", durationMinutes: "", notes: "",
};

function originalMoney(value) {
  if (!value) return "Unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: value.currency,
    maximumFractionDigits: value.currency === "LBP" ? 2 : 2,
  }).format(value.amount);
}

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function RecordDetails({ record }) {
  return <>
    <td>{originalMoney(record.revenue)}</td>
    <td>{formatCurrency(record.revenue.usd)}</td>
    <td>{record.completedSessions ?? "Unknown"}</td>
    <td>{record.expenses ? originalMoney(record.expenses) : "Unknown"}</td>
    <td>{record.activities.length ? record.activities.map((item) => activityLabels[item] ?? item).join(", ") : "Unknown"}</td>
    <td><b className={`historical-status historical-status--${record.status}`}>{statusLabel(record.status)}</b>{record.warnings.length > 0 && <small>{record.warnings.join(" · ")}</small>}</td>
  </>;
}

export function HistoricalDataManager({ businessId }) {
  const inputRef = useRef(null);
  const [payload, setPayload] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [state, setState] = useState({ loading: false, saving: false, error: "", success: "" });
  const [imports, setImports] = useState({ items: [], loading: true, error: "" });
  const [editor, setEditor] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(emptyManualRecord);

  const loadImports = useCallback(async () => {
    setImports((current) => ({ ...current, loading: true, error: "" }));
    try {
      const result = await getHistoricalImports(1, 20);
      setImports({ items: result.items, loading: false, error: "" });
    } catch (error) {
      setImports({ items: [], loading: false, error: error.message });
    }
  }, []);

  useEffect(() => { loadImports(); }, [loadImports]);

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    setPreview(null);
    setPayload(null);
    setEditor(null);
    setState({ loading: false, saving: false, error: "", success: "" });
    if (!file) return;
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".json") || (file.type && file.type !== "application/json")) {
      setState((current) => ({ ...current, error: "Choose a JSON file. PDF, image, CSV, and Excel files are not accepted." }));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setState((current) => ({ ...current, error: "The JSON file is larger than the supported 256 KB request limit." }));
      return;
    }
    setState((current) => ({ ...current, loading: true }));
    try {
      const parsed = JSON.parse(await file.text());
      const result = await previewHistoricalImport(parsed);
      setPayload(parsed);
      setPreview(result);
      setState((current) => ({ ...current, loading: false }));
    } catch (error) {
      const details = Array.isArray(error.details) ? error.details.join(" · ") : "";
      setState((current) => ({ ...current, loading: false, error: details || error.message || "The JSON file is invalid." }));
    }
  };

  const beginEdit = (businessDate) => {
    const sourceRecord = payload?.records?.find((item) => item.business_date === businessDate);
    if (!sourceRecord) return;
    setEditor({ businessDate, value: JSON.stringify(sourceRecord, null, 2), error: "", saving: false });
  };

  const applyEdit = async () => {
    if (!payload || !editor) return;
    setEditor((current) => ({ ...current, saving: true, error: "" }));
    try {
      const editedRecord = JSON.parse(editor.value);
      const updatedPayload = {
        ...payload,
        records: payload.records.map((item) => item.business_date === editor.businessDate ? editedRecord : item),
      };
      const updatedPreview = await previewHistoricalImport(updatedPayload);
      setPayload(updatedPayload);
      setPreview(updatedPreview);
      setEditor(null);
      setState((current) => ({ ...current, error: "", success: "" }));
    } catch (error) {
      const details = Array.isArray(error.details) ? error.details.join(" · ") : "";
      setEditor((current) => ({ ...current, saving: false, error: details || error.message || "This record is invalid." }));
    }
  };

  const updateManual = (field) => (event) => setManual((current) => ({ ...current, [field]: event.target.value }));

  const previewManualRecord = async (event) => {
    event.preventDefault();
    setState({ loading: true, saving: false, error: "", success: "" });
    const revenue = {
      total: manual.revenue.trim(),
      currency: manual.currency,
      ...(manual.currency === "LBP" ? { exchange_rate_to_usd: manual.exchangeRate.trim() } : {}),
      ...(manual.activity ? { by_activity: [{ activity_type: manual.activity, revenue: manual.revenue.trim() }] } : {}),
    };
    const record = { business_date: manual.businessDate, revenue };
    if (manual.expenses.trim() !== "") record.expenses = {
      total: manual.expenses.trim(),
      currency: manual.expenseCurrency,
      ...(manual.expenseCurrency === "LBP" ? { exchange_rate_to_usd: manual.expenseExchangeRate.trim() } : {}),
    };
    const operations = {};
    if (manual.completedSessions !== "") operations.completed_sessions = Number(manual.completedSessions);
    if (manual.durationMinutes !== "") operations.total_duration_seconds = Math.round(Number(manual.durationMinutes) * 60);
    if (Object.keys(operations).length) record.operations = operations;
    if (manual.notes.trim()) record.notes = manual.notes.trim();
    const manualPayload = {
      schema_version: "1.0",
      data_type: "historical_business_data",
      period_type: "daily",
      coverage: { start_business_date: manual.businessDate, end_business_date: manual.businessDate, mode: "complete" },
      source: { type: "manual_ledger", reference: `Manual daily entry ${manual.businessDate}` },
      records: [record],
    };
    try {
      const result = await previewHistoricalImport(manualPayload);
      setPayload(manualPayload);
      setPreview(result);
      setEditor(null);
      setFileName("Manual daily record");
      setState({ loading: false, saving: false, error: "", success: "" });
    } catch (error) {
      const details = Array.isArray(error.details) ? error.details.join(" · ") : "";
      setState({ loading: false, saving: false, error: details || error.message || "The daily record is invalid.", success: "" });
    }
  };

  const confirm = async () => {
    if (!payload || !preview?.canConfirm || editor) return;
    setState((current) => ({ ...current, saving: true, error: "", success: "" }));
    try {
      const result = await confirmHistoricalImport(payload);
      invalidateBusinessRequestCache(businessId);
      setPreview(null);
      setPayload(null);
      setFileName("");
      setManual(emptyManualRecord);
      setManualOpen(false);
      if (inputRef.current) inputRef.current.value = "";
      setState({ loading: false, saving: false, error: "", success: `${result.recordCount} historical business days were imported successfully.` });
      await loadImports();
    } catch (error) {
      setState((current) => ({ ...current, saving: false, error: error.message }));
    }
  };

  return <div className="business-view historical-data">
    <header className="historical-data__header">
      <p className="eyebrow">Business Center · Historical Data</p>
      <h2>Historical Data</h2>
      <p>Import previous business records so they can be included in long-term Business analytics.</p>
    </header>

    <section className="historical-upload" aria-labelledby="historical-upload-title">
      <div>
        <p className="eyebrow">Structured daily records</p>
        <h3 id="historical-upload-title">Upload Lounge Hall JSON</h3>
        <p>Upload a Lounge Hall historical JSON file. You will review every record before anything is saved.</p>
      </div>
      <label className="historical-upload__button">
        <span>{state.loading ? "Validating…" : "Upload JSON File"}</span>
        <input ref={inputRef} type="file" accept=".json,application/json" onChange={chooseFile} disabled={state.loading || state.saving} />
      </label>
      <small>{fileName || "JSON only · Maximum 256 KB"}</small>
    </section>

    <section className="historical-manual" aria-labelledby="historical-manual-title">
      <div className="historical-manual__heading">
        <div><p className="eyebrow">Manual daily entry</p><h3 id="historical-manual-title">Add one historical day</h3><p>Enter an old business day manually, review it, then confirm it like a JSON import.</p></div>
        <button type="button" onClick={() => setManualOpen((open) => !open)} aria-expanded={manualOpen} aria-controls="historical-manual-form">{manualOpen ? "Close" : "Add Daily Record"}</button>
      </div>
      {manualOpen && <form id="historical-manual-form" className="historical-manual__form" onSubmit={previewManualRecord}>
        <label><span>Business date</span><input type="date" value={manual.businessDate} onChange={updateManual("businessDate")} required /></label>
        <label><span>Revenue</span><input type="text" inputMode="decimal" placeholder="0.00" value={manual.revenue} onChange={updateManual("revenue")} required /></label>
        <label><span>Revenue currency</span><select value={manual.currency} onChange={updateManual("currency")}><option value="USD">USD</option><option value="LBP">LBP</option></select></label>
        {manual.currency === "LBP" && <label><span>LBP per 1 USD</span><input type="text" inputMode="decimal" placeholder="90000.00" value={manual.exchangeRate} onChange={updateManual("exchangeRate")} required /></label>}
        <label><span>Activity (optional)</span><select value={manual.activity} onChange={updateManual("activity")}><option value="">Unknown</option><option value="playstation">PlayStation</option><option value="billiard">Billiard</option><option value="pingpong">Ping-Pong</option></select></label>
        <label><span>Expenses (optional)</span><input type="text" inputMode="decimal" placeholder="Unknown" value={manual.expenses} onChange={updateManual("expenses")} /></label>
        {manual.expenses !== "" && <>
          <label><span>Expense currency</span><select value={manual.expenseCurrency} onChange={updateManual("expenseCurrency")}><option value="USD">USD</option><option value="LBP">LBP</option></select></label>
          {manual.expenseCurrency === "LBP" && <label><span>Expense LBP per 1 USD</span><input type="text" inputMode="decimal" placeholder="90000.00" value={manual.expenseExchangeRate} onChange={updateManual("expenseExchangeRate")} required /></label>}
        </>}
        <label><span>Completed sessions (optional)</span><input type="number" min="0" step="1" placeholder="Unknown" value={manual.completedSessions} onChange={updateManual("completedSessions")} /></label>
        <label><span>Total duration in minutes (optional)</span><input type="number" min="0" step="1" placeholder="Unknown" value={manual.durationMinutes} onChange={updateManual("durationMinutes")} /></label>
        <label className="historical-manual__notes"><span>Notes (optional)</span><textarea rows="3" maxLength="500" value={manual.notes} onChange={updateManual("notes")} /></label>
        <div className="historical-manual__submit"><p>Missing optional values stay unknown—not zero.</p><button type="submit" disabled={state.loading || state.saving}>{state.loading ? "Validating…" : "Review Daily Record"}</button></div>
      </form>}
    </section>

    {state.error && <div className="historical-message historical-message--error" role="alert"><strong>Import unavailable</strong><p>{state.error}</p></div>}
    {state.success && <div className="historical-message historical-message--success" role="status"><strong>Import complete</strong><p>{state.success}</p></div>}

    {preview && <section className="historical-preview" aria-labelledby="historical-preview-title">
      <div className="historical-preview__heading">
        <div><p className="eyebrow">Review before saving</p><h3 id="historical-preview-title">{preview.summary.label}</h3></div>
        <div className="historical-preview__counts"><span>{preview.warningCount} warnings</span><span className={preview.conflictCount ? "has-conflict" : ""}>{preview.conflictCount} conflicts</span></div>
      </div>
      <dl className="historical-preview__summary">
        <div><dt>Date range</dt><dd>{formatDate(preview.summary.startBusinessDate, { month: "short", day: "numeric" })} → {formatDate(preview.summary.endBusinessDate, { month: "short", day: "numeric", year: "numeric" })}</dd></div>
        <div><dt>Records</dt><dd>{preview.summary.recordCount} daily records</dd></div>
        <div><dt>Coverage</dt><dd>{statusLabel(preview.summary.coverageMode)}</dd></div>
        <div><dt>Revenue</dt><dd>{Object.entries(preview.summary.totalsByCurrency).map(([currency, amount]) => originalMoney({ currency, amount })).join(" + ")}</dd></div>
        <div><dt>Analytics value</dt><dd>{formatCurrency(preview.summary.revenueUsd)}</dd></div>
        <div><dt>Source</dt><dd>{preview.summary.source?.reference || preview.summary.source?.type?.replaceAll("_", " ") || "Not specified"}</dd></div>
      </dl>

      {preview.duplicateFile && <div className="historical-message historical-message--error" role="alert">This historical data has already been imported.</div>}

      {editor && <section className="historical-record-editor" aria-labelledby="historical-record-editor-title">
        <div><p className="eyebrow">Edit before import</p><h4 id="historical-record-editor-title">Edit {formatDate(editor.businessDate)}</h4><p>Update this daily record, then validate it again before confirming the import.</p></div>
        <label><span>Daily record JSON</span><textarea value={editor.value} onChange={(event) => setEditor((current) => ({ ...current, value: event.target.value, error: "" }))} rows="14" spellCheck="false" /></label>
        {editor.error && <p className="historical-record-editor__error" role="alert">{editor.error}</p>}
        <div className="historical-record-editor__actions"><button type="button" onClick={() => setEditor(null)} disabled={editor.saving}>Cancel</button><button type="button" onClick={applyEdit} disabled={editor.saving}>{editor.saving ? "Validating…" : "Save & Validate"}</button></div>
      </section>}

      <div className="historical-records-table analytics-table-wrap">
        <table><thead><tr><th>Date</th><th>Revenue</th><th>USD equivalent</th><th>Sessions</th><th>Expenses</th><th>Activity</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{preview.records.map((record) => <tr key={record.businessDate}><th>{formatDate(record.businessDate)}</th><RecordDetails record={record} /><td><button className="historical-edit-button" type="button" onClick={() => beginEdit(record.businessDate)}>Edit</button></td></tr>)}</tbody>
        </table>
      </div>
      <div className="historical-records-mobile">{preview.records.map((record) => <article key={record.businessDate}>
        <div><h4>{formatDate(record.businessDate)}</h4><div className="historical-records-mobile__actions"><b className={`historical-status historical-status--${record.status}`}>{statusLabel(record.status)}</b><button className="historical-edit-button" type="button" onClick={() => beginEdit(record.businessDate)}>Edit</button></div></div>
        <dl><div><dt>Revenue</dt><dd>{originalMoney(record.revenue)}</dd></div><div><dt>USD equivalent</dt><dd>{formatCurrency(record.revenue.usd)}</dd></div><div><dt>Sessions</dt><dd>{record.completedSessions ?? "Unknown"}</dd></div><div><dt>Expenses</dt><dd>{record.expenses ? originalMoney(record.expenses) : "Unknown"}</dd></div><div><dt>Activity</dt><dd>{record.activities.length ? record.activities.map((item) => activityLabels[item] ?? item).join(", ") : "Unknown"}</dd></div></dl>
        {record.warnings.length > 0 && <small>{record.warnings.join(" · ")}</small>}{record.notes && <p>{record.notes}</p>}
      </article>)}</div>

      <div className="historical-confirm">
        <p>You are about to add <strong>{preview.summary.recordCount} historical business days</strong> to Business analytics. This does not create live sessions.</p>
        <button type="button" onClick={confirm} disabled={!preview.canConfirm || state.saving || Boolean(editor)}>{state.saving ? "Saving all records…" : editor ? "Finish editing first" : "Confirm Historical Import"}</button>
      </div>
    </section>}

    <section className="historical-import-list" aria-labelledby="historical-import-list-title">
      <div><p className="eyebrow">Import history</p><h3 id="historical-import-list-title">Previous historical imports</h3></div>
      {imports.loading ? <p>Loading imports…</p> : imports.error ? <div className="historical-message historical-message--error"><p>{imports.error}</p><button type="button" onClick={loadImports}>Retry</button></div>
        : !imports.items.length ? <p className="business-empty-copy">No historical data has been imported yet.</p>
          : <div className="historical-batches">{imports.items.map((item) => <article key={item.id}><div><strong>{formatDate(item.coverageStart, { month: "long", year: "numeric" })}</strong><span className="historical-status historical-status--ready">{statusLabel(item.status)}</span></div><p>{item.recordCount} days · {(item.sourceType || "unspecified source").replaceAll("_", " ")}</p><small>Imported {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(item.confirmedAt))}</small></article>)}</div>}
    </section>
  </div>;
}
