import { useState } from "react";
import { formatCurrency } from "../../../utils/analytics";
import { combinedTotal } from "../../../utils/chartData";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

export function useChartSeries() {
  const [hidden, setHidden] = useState(() => new Set());
  const toggle = (key) => setHidden((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return { hidden, toggle };
}

export function ChartLegend({ hidden, onToggle }) {
  return <div className="chart-legend chart-legend--interactive" aria-label="Toggle activity series">{CHART_SERIES.map((series) => <button type="button" key={series.key} aria-pressed={!hidden.has(series.key)} className={hidden.has(series.key) ? "is-hidden" : ""} onClick={() => onToggle(series.key)}><i className={`chart-swatch chart-swatch--${series.key}`} aria-hidden="true" /><span>{series.label}</span><small>{series.short}</small></button>)}</div>;
}

export function AnalyticsTooltip({ active, payload, label, unit, currency = "USD" }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  const format = unit === "currency"
    ? (value) => formatCurrency(value, currency)
    : unit === "activeSessions"
      ? (value) => { const count = Math.round(Number(value || 0)); return `${count} active session${count === 1 ? "" : "s"}`; }
      : (value) => `${Math.round(Number(value || 0))} sessions`;
  return <div className="analytics-tooltip" role="status"><strong>{row.tooltipLabel ?? label}</strong>{CHART_SERIES.map((series) => <span key={series.key}><i className={`chart-swatch chart-swatch--${series.key}`} aria-hidden="true" />{series.label}<b>{format(row[series.key])}</b></span>)}<span className="analytics-tooltip__total">{unit === "activeSessions" ? "Total" : "Combined total"}<b>{format(combinedTotal(row))}</b></span></div>;
}

export function ChartDataTable({ data, unit, currency = "USD", caption }) {
  const format = unit === "currency" ? (value) => formatCurrency(value, currency) : (value) => Math.round(Number(value || 0));
  const cell = (value, row) => row.isFuture || value === null || value === undefined ? "—" : format(value);
  return <details className="chart-data-details"><summary>View accessible data table</summary><div className="analytics-table-wrap"><table className="chart-data-table"><caption className="sr-only">{caption}</caption><thead><tr><th scope="col">Period</th>{CHART_SERIES.map((series) => <th scope="col" key={series.key}>{series.label}</th>)}<th scope="col">Total</th></tr></thead><tbody>{data.map((row) => <tr key={row.key}><th scope="row">{row.label}{row.isFuture ? " (future)" : ""}</th>{CHART_SERIES.map((series) => <td key={series.key}>{cell(row[series.key], row)}</td>)}<td>{cell(row.total ?? combinedTotal(row), row)}</td></tr>)}</tbody></table></div></details>;
}

export function AnalyticsChartPanel({ titleId, title, description, eyebrow = "Visual analytics", loading, error, onRetry, hasData, hidden, onToggle, data, unit, currency, summary, legend, emptyMessage, children }) {
  return <section className="analytics-panel chart-panel" aria-labelledby={titleId} aria-describedby={`${titleId}-description`}>
    <div className="analytics-panel__heading"><div><p className="eyebrow">{eyebrow}</p><h3 id={titleId}>{title}</h3></div><p id={`${titleId}-description`}>{description}</p></div>
    {!loading && !error && summary}
    {loading ? <ChartSkeleton /> : error ? <ChartErrorState onRetry={onRetry} /> : !hasData ? <ChartEmptyState message={emptyMessage} /> : <>
      {legend ?? <ChartLegend hidden={hidden} onToggle={onToggle} />}
      {children}
      {data.some((row) => row._unknown > 0) && <p className="chart-data-warning">Some unsupported activity values were excluded from the three configured series.</p>}
      <ChartDataTable data={data} unit={unit} currency={currency} caption={`${title}. ${description}`} />
    </>}
  </section>;
}

export function ChartSkeleton() { return <div className="chart-skeleton" aria-label="Loading chart" aria-busy="true"><span /><span /><span /><span /><span /></div>; }
export function ChartEmptyState({ message = "No completed activity was recorded for this period." }) { return <div className="chart-empty"><span aria-hidden="true">↔</span><p>{message}</p></div>; }
export function ChartErrorState({ onRetry }) { return <div className="chart-empty chart-error" role="alert"><span aria-hidden="true">!</span><p>Unable to load this chart.</p><button className="button button--secondary" type="button" onClick={onRetry}>Retry</button></div>; }
