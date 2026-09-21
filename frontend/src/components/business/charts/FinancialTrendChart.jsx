import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate, formatMonth } from "../../../utils/analytics";
import { ChartEmptyState, ChartErrorState, ChartSkeleton } from "./AnalyticsChartPanel";
import { handleTabListKeyDown } from "../../../utils/tabKeyboard";

const modes = {
  financial: {
    label: "Revenue / Expenses / Profit",
    series: [
      ["totalRevenue", "Revenue", "var(--business-ps)"],
      ["totalCosts", "Expenses", "var(--danger)"],
      ["netProfit", "Net Profit", "var(--accent-bright)"],
    ],
    unit: "currency",
  },
  margin: {
    label: "Profit Margin",
    series: [["profitMargin", "Profit Margin", "var(--business-pingpong)"]],
    unit: "percent",
  },
  expenses: {
    label: "Expense Categories",
    series: [
      ["rent", "Rent", "#8eb8dd"],
      ["electricity", "Electricity", "#e3ad68"],
      ["employees", "Employees", "#a991dc"],
      ["other", "Other", "#b5b9b6"],
    ],
    unit: "currency",
  },
};

function bucketLabel(key, period, timezone, long = false) {
  if (period === "daily") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "numeric", ...(long ? { minute: "2-digit" } : {}),
    }).format(new Date(key));
  }
  if (period === "yearly") {
    const [year, month] = key.split("-").map(Number);
    return formatMonth(year, month, { month: long ? "long" : "short" });
  }
  return formatDate(key, long ? { weekday: "short", month: "short", day: "numeric" } : { weekday: "short" });
}

function formatValue(value, unit) {
  if (value === null || value === undefined) return "—";
  return unit === "percent" ? `${Number(value).toFixed(2)}%` : formatCurrency(value);
}

function TrendTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="analytics-tooltip financial-trend-tooltip" role="status"><strong>{row.longLabel}</strong>{modes[mode].series.map(([key, label, color]) => <span key={key}><i style={{ background: color }} aria-hidden="true" />{label}<b>{formatValue(row[key], modes[mode].unit)}</b></span>)}{mode === "financial" && <span className="analytics-tooltip__total">Completed sessions<b>{row.sessions}</b></span>}</div>;
}

function DayFact({ label, day }) {
  if (!day) return <div><dt>{label}</dt><dd>—</dd></div>;
  return <div><dt>{label}</dt><dd>{formatDate(day.date, { weekday: "long" })}</dd><small>{formatCurrency(day.revenue)} · {day.sessions} session{day.sessions === 1 ? "" : "s"}</small></div>;
}

export function FinancialTrendChart({ query }) {
  const [mode, setMode] = useState("financial");
  const data = useMemo(() => (query.data?.trend ?? []).map((row) => ({
    ...row,
    label: bucketLabel(row.key, query.data.period.selected, query.data.period.timezone),
    longLabel: bucketLabel(row.key, query.data.period.selected, query.data.period.timezone, true),
    rent: row.expenseCategories.RENT,
    electricity: row.expenseCategories.ELECTRICITY,
    employees: row.expenseCategories.EMPLOYEES,
    other: row.expenseCategories.OTHER,
  })), [query.data]);
  if (query.loading) return <section className="analytics-panel chart-panel financial-trend"><ChartSkeleton /></section>;
  if (query.error) return <section className="analytics-panel chart-panel financial-trend"><ChartErrorState onRetry={query.retry} /></section>;
  if (!query.data) return null;
  const hasData = data.some((row) => row.sessions > 0 || row.totalRevenue !== 0 || row.totalCosts !== 0);
  const config = modes[mode];
  const dayFacts = query.data.businessDays;
  const operations = query.data.operations;
  const showDayRange = dayFacts.observedDays > 1;
  const description = query.data.period.selected === "daily"
    ? "Revenue is bucketed by completion hour; recorded daily expenses are allocated across the displayed hours so totals reconcile."
    : "Backend-bucketed actual results for the selected business period.";
  return <section className="analytics-panel chart-panel financial-trend" aria-labelledby="financial-trend-title">
    <div className="analytics-panel__heading"><div><p className="eyebrow">Financial movement</p><h3 id="financial-trend-title">Performance Trend</h3></div><p>{description}</p></div>
    <div className="financial-trend__modes" role="tablist" aria-label="Trend metric" onKeyDown={handleTabListKeyDown}>
      {Object.entries(modes).map(([key, item]) => <button key={key} id={`financial-trend-tab-${key}`} type="button" role="tab" aria-controls="financial-trend-panel" aria-selected={mode === key} tabIndex={mode === key ? 0 : -1} className={mode === key ? "is-active" : ""} onClick={() => setMode(key)}>{item.label}</button>)}
    </div>
    <dl className="financial-trend__facts">
      {showDayRange && <DayFact label="Strongest observed business day" day={dayFacts.strongest} />}
      {showDayRange && <DayFact label="Weakest observed business day" day={dayFacts.weakest} />}
      <div><dt>Cancelled sessions</dt><dd>{operations.cancelledSessions}</dd><small>{operations.cancellationRate === null ? "No terminal sessions" : `${operations.cancellationRate}% of completed + cancelled sessions`}</small></div>
    </dl>
    <div id="financial-trend-panel" role="tabpanel" aria-labelledby={`financial-trend-tab-${mode}`} tabIndex="0">{!hasData ? <ChartEmptyState message="No completed sessions or recorded expenses were found for this period." /> : <>
      <div className="financial-trend__legend">{config.series.map(([key, label, color]) => <span key={key}><i style={{ background: color }} />{label}</span>)}</div>
      <div className="business-chart financial-trend__chart" role="img" aria-label={`${config.label} trend for the selected period`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 12, left: 2, bottom: 8 }} accessibilityLayer>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={34} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={62} tickFormatter={(value) => config.unit === "percent" ? `${Number(value).toFixed(0)}%` : new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 1 }).format(value)} />
            <Tooltip content={<TrendTooltip mode={mode} />} cursor={{ stroke: "var(--chart-crosshair)", strokeWidth: 1 }} />
            {config.series.map(([key, label, color]) => <Line key={key} type="linear" dataKey={key} name={label} stroke={color} strokeWidth={2.5} dot={data.length <= 12 ? { r: 3, fill: color } : false} activeDot={{ r: 5, fill: "var(--chart-background)", stroke: color, strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data-details"><summary>View trend data table</summary><div className="analytics-table-wrap"><table className="chart-data-table"><caption className="sr-only">{config.label} trend</caption><thead><tr><th scope="col">Period</th>{config.series.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}{mode === "financial" && <th scope="col">Sessions</th>}</tr></thead><tbody>{data.map((row) => <tr key={row.key}><th scope="row">{row.longLabel}</th>{config.series.map(([key]) => <td key={key}>{formatValue(row[key], config.unit)}</td>)}{mode === "financial" && <td>{row.sessions}</td>}</tr>)}</tbody></table></div></details>
    </>}</div>
  </section>;
}
