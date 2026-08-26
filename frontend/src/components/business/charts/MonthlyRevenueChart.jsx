import { useMemo } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate, formatMonth } from "../../../utils/analytics";
import { buildMonthlyRevenueData, hasChartData, summarizeMonthlyRevenue } from "../../../utils/chartData";
import { AnalyticsChartPanel, useChartSeries } from "./AnalyticsChartPanel";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

const compactCurrency = (value, currency) => new Intl.NumberFormat("en-US", {
  style: "currency", currency, notation: "compact", maximumFractionDigits: 1,
}).format(Number(value || 0));

function MonthlyLegend({ hidden, onToggle }) {
  const series = [...CHART_SERIES, { key: "total", label: "Total Revenue", short: "TOTAL" }];
  return <div className="chart-legend chart-legend--interactive monthly-chart-legend" aria-label="Toggle monthly revenue series">{series.map((item) => <button type="button" key={item.key} aria-pressed={!hidden.has(item.key)} className={hidden.has(item.key) ? "is-hidden" : ""} onClick={() => onToggle(item.key)}><i className={item.key === "total" ? "monthly-legend-symbol monthly-legend-symbol--line" : `monthly-legend-symbol monthly-legend-symbol--${item.key}`} aria-hidden="true" /><span>{item.label}</span><small>{item.short}</small></button>)}</div>;
}

function MonthlyRevenueTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  if (row.isFuture) return <div className="analytics-tooltip"><strong>{formatDate(row.key)}</strong><span>Future date</span></div>;
  return <div className="analytics-tooltip monthly-revenue-tooltip" role="status"><strong>{formatDate(row.key)}</strong>{CHART_SERIES.map((series) => <span key={series.key}><i className={`chart-swatch chart-swatch--${series.key}`} aria-hidden="true" />{series.label}<b>{formatCurrency(row[series.key], currency)}</b></span>)}<span className="analytics-tooltip__total">Combined total<b>{formatCurrency(row.total, currency)}</b></span></div>;
}

function DayTick({ x, y, payload, lastDay, futureDays }) {
  const day = Number(payload.value);
  if (![1, 5, 10, 15, 20, 25, lastDay].includes(day)) return null;
  return <text x={x} y={y + 15} textAnchor="middle" fill={futureDays.has(day) ? "var(--chart-axis-future)" : "var(--chart-axis)"} fontSize="11">{day}</text>;
}

export function MonthlyRevenueChart({ days = [], period, year, month, currency = "USD", loading = false, error = null, onRetry }) {
  const data = useMemo(() => buildMonthlyRevenueData(days, { businessDate: period?.businessDate }), [days, period?.businessDate]);
  const metrics = useMemo(() => summarizeMonthlyRevenue(data), [data]);
  const { hidden, toggle } = useChartSeries();
  const monthLabel = formatMonth(year, month);
  const description = `Daily revenue composition and movement throughout ${monthLabel}`;
  const lastDay = data.length || new Date(Date.UTC(year, month, 0)).getUTCDate();
  const futureDays = useMemo(() => new Set(data.filter((row) => row.isFuture).map((row) => row.day)), [data]);
  const summary = <dl className="monthly-chart-summary"><div><dt>Monthly Revenue</dt><dd>{formatCurrency(metrics.monthlyRevenue, currency)}</dd></div><div><dt>Average per Active Day</dt><dd>{metrics.averagePerActiveDay === null ? "—" : formatCurrency(metrics.averagePerActiveDay, currency)}</dd></div><div><dt>Best Performing Day</dt><dd>{metrics.bestDay ? formatDate(metrics.bestDay.key, { month: "short", day: "numeric" }) : "—"}</dd>{metrics.bestDay && <small>{formatCurrency(metrics.bestDay.total, currency)}</small>}</div></dl>;

  return <AnalyticsChartPanel titleId="monthly-revenue-overview-title" title="Monthly Revenue Overview" description={description} loading={loading} error={error} onRetry={onRetry} hasData={hasChartData(data)} hidden={hidden} onToggle={toggle} data={data} unit="currency" currency={currency} summary={summary} legend={<MonthlyLegend hidden={hidden} onToggle={toggle} />} emptyMessage="No revenue activity was recorded for this month.">
    <p className="sr-only">Stacked columns show daily revenue composition by activity. The neutral line shows combined daily revenue. Future days are not plotted.</p>
    <div className="business-chart business-chart--monthly" role="img" aria-label={`Monthly revenue composed chart. ${description}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 18, right: 12, left: 2, bottom: 8 }} accessibilityLayer barCategoryGap="28%">
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="day" axisLine={false} tickLine={false} interval={0} height={34} tick={<DayTick lastDay={lastDay} futureDays={futureDays} />} padding={{ left: 6, right: 6 }} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => compactCurrency(value, currency)} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={58} domain={[0, "auto"]} />
          <Tooltip content={<MonthlyRevenueTooltip currency={currency} />} cursor={{ fill: "var(--chart-cursor)" }} />
          {!hidden.has("playstation") && <Bar dataKey="playstation" name="PlayStation" stackId="revenue" fill={CHART_COLORS.playstation} maxBarSize={24} isAnimationActive={false} />}
          {!hidden.has("billiard") && <Bar dataKey="billiard" name="Billiard" stackId="revenue" fill={CHART_COLORS.billiard} maxBarSize={24} isAnimationActive={false} />}
          {!hidden.has("pingpong") && <Bar dataKey="pingpong" name="Ping Pong" stackId="revenue" fill={CHART_COLORS.pingpong} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />}
          {!hidden.has("total") && <Line type="linear" dataKey="total" name="Total Revenue" stroke="var(--chart-total)" strokeWidth={2.5} connectNulls={false} dot={{ r: 2.5, fill: "var(--chart-background)", stroke: "var(--chart-total)", strokeWidth: 1.8 }} activeDot={{ r: 5, fill: "var(--chart-background)", stroke: "var(--chart-total)", strokeWidth: 2 }} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </AnalyticsChartPanel>;
}
