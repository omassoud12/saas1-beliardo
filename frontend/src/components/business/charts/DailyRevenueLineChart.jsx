import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "../../../utils/analytics";
import { buildRevenueSeries, hasChartData } from "../../../utils/chartData";
import { AnalyticsChartPanel, AnalyticsTooltip, useChartSeries } from "./AnalyticsChartPanel";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

const compact = (value, currency) => new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));

export function DailyRevenueLineChart({ days = [], year, month, currency = "USD", loading = false, error = null, onRetry }) {
  const data = useMemo(() => buildRevenueSeries(days, (key) => String(Number(key.slice(-2)))), [days]);
  const { hidden, toggle } = useChartSeries();
  const description = `Revenue movement throughout ${formatMonth(year, month)}`;
  return <AnalyticsChartPanel titleId="daily-revenue-trend-title" title="Daily Revenue Trend" description={description} loading={loading} error={error} onRetry={onRetry} hasData={hasChartData(data)} hidden={hidden} onToggle={toggle} data={data} unit="currency" currency={currency}>
    <div className="business-chart" role="img" aria-label={`Daily revenue trend. ${description}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 14, right: 10, left: 0, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={2} minTickGap={12} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => compact(value, currency)} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={56} />
          <Tooltip content={<AnalyticsTooltip unit="currency" currency={currency} />} cursor={{ stroke: "var(--chart-crosshair)", strokeWidth: 1 }} />
          {CHART_SERIES.map((series) => !hidden.has(series.key) && <Line key={series.key} type="linear" dataKey={series.key} name={series.label} stroke={CHART_COLORS[series.key]} strokeWidth={2.2} dot={{ r: 2.5, strokeWidth: 1.5, fill: "var(--chart-tooltip-bg)" }} activeDot={{ r: 5, strokeWidth: 2 }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </AnalyticsChartPanel>;
}
