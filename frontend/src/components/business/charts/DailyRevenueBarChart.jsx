import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "../../../utils/analytics";
import { buildRevenueSeries, hasChartData } from "../../../utils/chartData";
import { AnalyticsChartPanel, AnalyticsTooltip, useChartSeries } from "./AnalyticsChartPanel";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

const compactCurrency = (value, currency) => new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));

export function DailyRevenueBarChart({ days = [], year, month, currency = "USD", loading = false, error = null, onRetry }) {
  const data = useMemo(() => buildRevenueSeries(days, (key) => String(Number(key.slice(-2)))), [days]);
  const { hidden, toggle } = useChartSeries();
  const description = `Revenue by activity throughout ${formatMonth(year, month)}`;
  return <AnalyticsChartPanel titleId="daily-revenue-breakdown-title" title="Daily Revenue Breakdown" description={description} loading={loading} error={error} onRetry={onRetry} hasData={hasChartData(data)} hidden={hidden} onToggle={toggle} data={data} unit="currency" currency={currency}>
    <div className="business-chart" role="img" aria-label={`Daily revenue breakdown. ${description}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 4 }} accessibilityLayer barGap={2}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={2} minTickGap={12} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => compactCurrency(value, currency)} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={56} />
          <Tooltip content={<AnalyticsTooltip unit="currency" currency={currency} />} cursor={{ fill: "var(--chart-cursor)" }} />
          {CHART_SERIES.map((series) => !hidden.has(series.key) && <Bar key={series.key} dataKey={series.key} name={series.label} fill={CHART_COLORS[series.key]} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  </AnalyticsChartPanel>;
}
