import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { downloadBusinessReport } from "../../lib/businessSummaryApi";
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

export function BusinessReportExport({ reportType, date, year, month }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState({ generating: false, error: "", success: "" });
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submittingRef.current) setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const close = () => {
    if (!status.generating) setOpen(false);
  };

  const generate = async (event) => {
    event.preventDefault();
    if (submittingRef.current || !form) return;
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
      setStatus({ generating: false, error: "", success: `${filename} downloaded.` });
    } catch (error) {
      setStatus({ generating: false, error: error.message || "Unable to generate the report", success: "" });
    } finally {
      submittingRef.current = false;
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
            <header><div><p className="eyebrow">Business report</p><h2 id="business-report-title">Export PDF</h2></div><button type="button" onClick={close} disabled={status.generating} aria-label="Close report configuration">×</button></header>
            <form onSubmit={generate}>
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
              <footer><button className="button button--secondary" type="button" onClick={close} disabled={status.generating}>Cancel</button><button className="button button--primary" type="submit" disabled={status.generating || !Object.values(form.sections).some(Boolean)}>{status.generating ? "Generating PDF…" : "Generate PDF"}</button></footer>
            </form>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
