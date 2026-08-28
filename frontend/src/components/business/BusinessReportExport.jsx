import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  downloadBusinessReport,
  downloadSavedBusinessReport,
  getBusinessReportExports,
} from "../../lib/businessSummaryApi";
import { formatDate, formatMonth } from "../../utils/analytics";

const sectionOptions = [
  ["summary", "Summary KPIs"],
  ["charts", "Business charts"],
  ["categoryBreakdown", "Category breakdown"],
  ["detailsTable", "Detailed data table"],
];

function periodLabel({ reportType, date, year, month }) {
  if (reportType === "daily") return formatDate(date);
  if (reportType === "monthly") return formatMonth(year, month);
  return String(year);
}

function defaultTitle(reportType, period) {
  return `${reportType[0].toUpperCase()}${reportType.slice(1)} Business Report · ${period}`;
}

function reportDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const emptyLibrary = { loading: false, error: "", quota: null, reports: [] };

export function BusinessReportExport({ reportType, date, year, month }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState({ generating: false, error: "", success: "" });
  const [library, setLibrary] = useState(emptyLibrary);
  const [downloadingId, setDownloadingId] = useState(null);
  const submittingRef = useRef(false);
  const period = periodLabel({ reportType, date, year, month });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: defaultTitle(reportType, period),
      notes: "",
      language: "en",
      sections: Object.fromEntries(sectionOptions.map(([key]) => [key, true])),
    });
    setStatus({ generating: false, error: "", success: "" });
  }, [open, reportType, period]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setLibrary((current) => ({ ...current, loading: true, error: "" }));
    getBusinessReportExports(controller.signal)
      .then((data) => setLibrary({ loading: false, error: "", quota: data.quota, reports: data.reports }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setLibrary((current) => ({
            ...current,
            loading: false,
            error: error.message || "Unable to load saved reports",
          }));
        }
      });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submittingRef.current && !downloadingId) setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, downloadingId]);

  const busy = status.generating || Boolean(downloadingId);
  const quotaReached = library.quota?.remaining === 0;

  const close = () => {
    if (!busy) setOpen(false);
  };

  const refreshLibrary = async () => {
    const data = await getBusinessReportExports();
    setLibrary({ loading: false, error: "", quota: data.quota, reports: data.reports });
  };

  const generate = async (event) => {
    event.preventDefault();
    if (submittingRef.current || !form || quotaReached) return;
    submittingRef.current = true;
    setStatus({ generating: true, error: "", success: "" });
    try {
      const filename = await downloadBusinessReport({
        reportType,
        ...(reportType === "daily" ? { date } : {}),
        ...(["monthly", "yearly"].includes(reportType) ? { year } : {}),
        ...(reportType === "monthly" ? { month } : {}),
        title: form.title,
        notes: form.notes,
        sections: form.sections,
        language: form.language,
      });
      await refreshLibrary().catch(() => {});
      setStatus({ generating: false, error: "", success: `${filename} downloaded.` });
    } catch (error) {
      if (error.details?.limit) {
        setLibrary((current) => ({ ...current, quota: { ...current.quota, ...error.details } }));
      }
      setStatus({ generating: false, error: error.message || "Unable to generate the report", success: "" });
    } finally {
      submittingRef.current = false;
    }
  };

  const downloadSaved = async (report) => {
    if (busy) return;
    setDownloadingId(report.id);
    setStatus({ generating: false, error: "", success: "" });
    try {
      const filename = await downloadSavedBusinessReport(report);
      setStatus({ generating: false, error: "", success: `${filename} downloaded.` });
    } catch (error) {
      setStatus({ generating: false, error: error.message || "Unable to download the saved report", success: "" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <button className="business-report-trigger" type="button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">PDF</span> Export PDF
      </button>
      {open && form && createPortal(
        <div className="business-report-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section className="business-report-dialog" role="dialog" aria-modal="true" aria-labelledby="business-report-title">
            <header>
              <div><p className="eyebrow">Business report</p><h2 id="business-report-title">Export PDF</h2></div>
              <button type="button" onClick={close} disabled={busy} aria-label="Close report configuration">×</button>
            </header>
            <form onSubmit={generate}>
              <div className="business-report-quota" aria-live="polite">
                {library.loading && !library.quota ? <span>Loading monthly quota...</span> : library.quota ? (
                  <><strong>{library.quota.remaining} of {library.quota.limit} exports remaining</strong><span>{library.quota.month.slice(0, 7)}</span></>
                ) : <span>Monthly quota unavailable</span>}
              </div>
              <div className="business-report-fields">
                <label><span>Report type</span><input value={`${reportType[0].toUpperCase()}${reportType.slice(1)}`} readOnly /></label>
                <label><span>Selected period</span><input value={period} readOnly /></label>
                <label><span>Report language</span><select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}><option value="en">English</option><option value="ar">العربية</option></select></label>
                <label className="business-report-field--wide"><span>Report title</span><input value={form.title} maxLength="120" required onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
                <label className="business-report-field--wide"><span>Owner notes <small>Optional</small></span><textarea value={form.notes} maxLength="1000" rows="4" onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
              </div>
              <fieldset><legend>Include in report</legend><div className="business-report-toggles">{sectionOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={form.sections[key]} onChange={(event) => setForm({ ...form, sections: { ...form.sections, [key]: event.target.checked } })} /><span>{label}</span></label>)}</div></fieldset>
              {status.error && <p className="business-report-message business-report-message--error" role="alert">{status.error}</p>}
              {status.success && <p className="business-report-message business-report-message--success" role="status">{status.success}</p>}
              <section className="business-report-library" aria-labelledby="saved-business-reports-title">
                <div className="business-report-library__header"><h3 id="saved-business-reports-title">Saved reports</h3><span>{library.reports.length}</span></div>
                {library.error ? <p className="business-report-library__empty">{library.error}</p> : !library.loading && library.reports.length === 0 ? <p className="business-report-library__empty">No saved reports yet.</p> : (
                  <div className="business-report-library__list">{library.reports.map((report) => (
                    <div className="business-report-library__row" key={report.id}>
                      <div><strong>{report.title || report.filename}</strong><span>{report.reportType} / {report.periodKey} / {reportDate(report.completedAt)}</span></div>
                      <button className="button button--secondary" type="button" onClick={() => downloadSaved(report)} disabled={busy}>{downloadingId === report.id ? "Downloading..." : "Download"}</button>
                    </div>
                  ))}</div>
                )}
              </section>
              <footer>
                <button className="button button--secondary" type="button" onClick={close} disabled={busy}>Cancel</button>
                <button className="button button--primary" type="submit" disabled={busy || quotaReached || !Object.values(form.sections).some(Boolean)}>{status.generating ? "Generating PDF..." : quotaReached ? "Monthly limit reached" : "Generate PDF"}</button>
              </footer>
            </form>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
