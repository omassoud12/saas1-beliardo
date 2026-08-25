import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "../../../utils/analytics";
import { buildRevenueSeries, hasChartData } from "../../../utils/chartData";
import { AnalyticsChartPanel, AnalyticsTooltip, useChartSeries } from "./AnalyticsChartPanel";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

const compact = (value, currency) => new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));

function MonthTick({ x, y, payload, currentLabel }) {
  const current = payload.value === currentLabel;
  return <g transform={`translate(${x},${y})`}><text y={14} textAnchor="middle" fill={current ? "var(--text-soft)" : "var(--chart-axis)"} fontSize="11" fontWeight={current ? "700" : "400"}>{payload.value}</text>{current && <circle cy={23} r="2" fill="var(--chart-billiard)" />}</g>;
}

export function YearlyRevenueBarChart({ months = [], year, currency = "USD", timezone = "UTC", loading = false, error = null, onRetry }) {
  const data = useMemo(() => buildRevenueSeries(months, (key) => formatMonth(Number(key.slice(0, 4)), Number(key.slice(5)), { month: "short" })), [months]);
  const { hidden, toggle } = useChartSeries();
  const description = `Monthly revenue throughout ${year}`;
  const nowParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric" }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const currentLabel = year === Number(nowParts.year) ? formatMonth(year, Number(nowParts.month), { month: "short" }) : "";
  return <AnalyticsChartPanel titleId="yearly-revenue-overview-title" title="Yearly Revenue Overview" description={description} loading={loading} error={error} onRetry={onRetry} hasData={hasChartData(data)} hidden={hidden} onToggle={toggle} data={data} unit="currency" currency={currency}>
    <div className="business-chart business-chart--year" role="img" aria-label={`Yearly revenue overview. ${description}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 14, right: 10, left: 0, bottom: 12 }} accessibilityLayer barGap={3}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} height={40} tick={<MonthTick currentLabel={currentLabel} />} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => compact(value, currency)} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={58} />
          <Tooltip content={<AnalyticsTooltip unit="currency" currency={currency} />} cursor={{ fill: "var(--chart-cursor)" }} />
          {CHART_SERIES.map((series) => !hidden.has(series.key) && <Bar key={series.key} dataKey={series.key} name={series.label} fill={CHART_COLORS[series.key]} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  </AnalyticsChartPanel>;
}
