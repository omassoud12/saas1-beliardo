import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate, formatMonth } from "../../../utils/analytics";
import { buildMonthlyRevenueData, hasChartData, summarizeMonthlyRevenue } from "../../../utils/chartData";
import { AnalyticsChartPanel, useChartSeries } from "./AnalyticsChartPanel";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

const compactCurrency = (value, currency) => new Intl.NumberFormat("en-US", {
  style: "currency", currency, notation: "compact", maximumFractionDigits: 1,
}).format(Number(value || 0));

function enrichWithSessionCounts(rows, days) {
  const buckets = new Map((days ?? []).map((day) => [day.key, day]));
  return rows.map((row) => {
    if (row.isFuture) {
      return { ...row, playstationSessions: null, billiardSessions: null, pingpongSessions: null, sessionTotal: null };
    }
    const bucket = buckets.get(row.key);
    const counts = Object.fromEntries(CHART_SERIES.map((series) => [
      `${series.key}Sessions`,
      Number(bucket?.activities?.find((activity) => activity.type === series.key)?.sessions || 0),
    ]));
    return { ...row, ...counts, sessionTotal: CHART_SERIES.reduce((sum, series) => sum + counts[`${series.key}Sessions`], 0) };
  });
}

function MonthlyRevenueTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  if (row.isFuture) return <div className="analytics-tooltip"><strong>{formatDate(row.key)}</strong><span>Future date</span></div>;
  return <div className="analytics-tooltip monthly-revenue-tooltip" role="status"><strong>{formatDate(row.key)}</strong>{CHART_SERIES.map((series) => <span key={series.key}><i className={`chart-swatch chart-swatch--${series.key}`} aria-hidden="true" />{series.label}<b>{formatCurrency(row[series.key], currency)}<small>{row[`${series.key}Sessions`]} sessions</small></b></span>)}<span className="analytics-tooltip__total">Combined total<b>{formatCurrency(row.total, currency)}<small>{row.sessionTotal} sessions</small></b></span></div>;
}

function MonthlyVolumeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  if (row.isFuture) return <div className="analytics-tooltip"><strong>{formatDate(row.key)}</strong><span>Future date</span></div>;
  return <div className="analytics-tooltip monthly-volume-tooltip" role="status"><strong>{formatDate(row.key)}</strong>{CHART_SERIES.map((series) => <span key={series.key}><i className={`chart-swatch chart-swatch--${series.key}`} aria-hidden="true" />{series.label}<b>{row[`${series.key}Sessions`]}</b></span>)}<span className="analytics-tooltip__total">Total sessions<b>{row.sessionTotal}</b></span></div>;
}

function DayTick({ x, y, payload, lastDay, futureDays }) {
  const day = Number(payload.value);
  if (![1, 5, 10, 15, 20, 25, lastDay].includes(day)) return null;
  return <text x={x} y={y + 15} textAnchor="middle" fill={futureDays.has(day) ? "var(--chart-axis-future)" : "var(--chart-axis)"} fontSize="11">{day}</text>;
}

function MonthlySessionTable({ data, monthLabel }) {
  const value = (row, key) => row.isFuture ? "-" : Math.round(Number(row[key] || 0));
  return <details className="chart-data-details monthly-volume-data"><summary>View daily session volume table</summary><div className="analytics-table-wrap"><table className="chart-data-table"><caption className="sr-only">Daily session volume throughout {monthLabel}</caption><thead><tr><th scope="col">Day</th>{CHART_SERIES.map((series) => <th scope="col" key={series.key}>{series.label}</th>)}<th scope="col">Total</th></tr></thead><tbody>{data.map((row) => <tr key={row.key}><th scope="row">{row.day}{row.isFuture ? " (future)" : ""}</th>{CHART_SERIES.map((series) => <td key={series.key}>{value(row, `${series.key}Sessions`)}</td>)}<td>{value(row, "sessionTotal")}</td></tr>)}</tbody></table></div></details>;
}

export function MonthlyRevenueChart({ days = [], period, year, month, currency = "USD", loading = false, error = null, onRetry }) {
  const data = useMemo(() => enrichWithSessionCounts(buildMonthlyRevenueData(days, { businessDate: period?.businessDate }), days), [days, period?.businessDate]);
  const metrics = useMemo(() => summarizeMonthlyRevenue(data), [data]);
  const { hidden, toggle } = useChartSeries();
  const monthLabel = formatMonth(year, month);
  const description = `Daily revenue and completed session volume throughout ${monthLabel}`;
  const lastDay = data.length || new Date(Date.UTC(year, month, 0)).getUTCDate();
  const futureDays = useMemo(() => new Set(data.filter((row) => row.isFuture).map((row) => row.day)), [data]);
  const summary = <dl className="monthly-chart-summary"><div><dt>Monthly Revenue</dt><dd>{formatCurrency(metrics.monthlyRevenue, currency)}</dd></div><div><dt>Average per Active Day</dt><dd>{metrics.averagePerActiveDay === null ? "-" : formatCurrency(metrics.averagePerActiveDay, currency)}</dd></div><div><dt>Peak Revenue Day</dt><dd>{metrics.bestDay ? formatDate(metrics.bestDay.key, { month: "short", day: "numeric" }) : "-"}</dd>{metrics.bestDay && <small>{formatCurrency(metrics.bestDay.total, currency)} / {metrics.bestDay.sessionTotal} sessions</small>}</div></dl>;
  const hasMonthlyData = hasChartData(data) || data.some((row) => Number(row.sessionTotal) > 0);

  return <AnalyticsChartPanel className="chart-panel--monthly-performance" titleId="monthly-revenue-overview-title" eyebrow="Month at a glance" title="Monthly Performance" description={description} loading={loading} error={error} onRetry={onRetry} hasData={hasMonthlyData} hidden={hidden} onToggle={toggle} data={data} unit="currency" currency={currency} summary={summary} emptyMessage="No completed activity was recorded for this month.">
    <p className="sr-only">The first chart shows daily revenue by activity. The second chart shows total completed session volume. Future days are not plotted.</p>
    <section className="monthly-chart-block" aria-labelledby="monthly-revenue-by-day-title">
      <div className="monthly-chart-block__heading"><div><h4 id="monthly-revenue-by-day-title">Revenue by Day</h4><p>Daily revenue by activity</p></div>{metrics.bestDay && <span>Peak {formatDate(metrics.bestDay.key, { month: "short", day: "numeric" })}</span>}</div>
      <div className="business-chart business-chart--monthly-revenue" role="img" aria-label={`Revenue by day chart. ${description}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 18, right: 12, left: 2, bottom: 8 }} accessibilityLayer>
            <defs>{CHART_SERIES.map((series) => <linearGradient key={series.key} id={`monthly-fill-${series.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS[series.key]} stopOpacity={0.18} /><stop offset="100%" stopColor={CHART_COLORS[series.key]} stopOpacity={0.015} /></linearGradient>)}</defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} interval={0} height={34} tick={<DayTick lastDay={lastDay} futureDays={futureDays} />} padding={{ left: 6, right: 6 }} />
            <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => compactCurrency(value, currency)} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={58} domain={[0, "auto"]} />
            <Tooltip content={<MonthlyRevenueTooltip currency={currency} />} cursor={{ stroke: "var(--chart-crosshair)", strokeWidth: 1 }} />
            {metrics.bestDay && <ReferenceLine x={metrics.bestDay.day} stroke="var(--chart-crosshair)" strokeDasharray="3 4" />}
            {CHART_SERIES.map((series) => !hidden.has(series.key) && <Area key={series.key} type="linear" dataKey={series.key} name={series.label} stroke={CHART_COLORS[series.key]} strokeWidth={2.5} fill={`url(#monthly-fill-${series.key})`} connectNulls={false} dot={false} activeDot={{ r: 5, fill: "var(--chart-background)", stroke: CHART_COLORS[series.key], strokeWidth: 2.5 }} isAnimationActive={false} />)}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
    <section className="monthly-chart-block monthly-chart-block--volume" aria-labelledby="monthly-session-volume-title">
      <div className="monthly-chart-block__heading"><div><h4 id="monthly-session-volume-title">Daily Session Volume</h4><p>Completed sessions per business day</p></div></div>
      <div className="business-chart business-chart--monthly-volume" role="img" aria-label={`Daily completed session volume throughout ${monthLabel}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 12, left: 2, bottom: 8 }} accessibilityLayer barCategoryGap="28%">
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} interval={0} height={34} tick={<DayTick lastDay={lastDay} futureDays={futureDays} />} padding={{ left: 6, right: 6 }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={58} domain={[0, (maximum) => Math.max(1, Math.ceil(maximum))]} />
            <Tooltip content={<MonthlyVolumeTooltip />} cursor={{ fill: "var(--chart-cursor)" }} />
            <Bar dataKey="sessionTotal" name="Completed Sessions" fill="var(--monthly-volume-bar)" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
    <MonthlySessionTable data={data} monthLabel={monthLabel} />
  </AnalyticsChartPanel>;
}
