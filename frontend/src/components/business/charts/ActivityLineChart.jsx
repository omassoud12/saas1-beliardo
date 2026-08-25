import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "../../../utils/analytics";
import { buildConcurrencyBuckets, hasChartData } from "../../../utils/chartData";
import { AnalyticsChartPanel, AnalyticsTooltip, useChartSeries } from "./AnalyticsChartPanel";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

export function ActivityLineChart({ sessions = [], period, date, loading = false, error = null, onRetry }) {
  const data = useMemo(() => buildConcurrencyBuckets(sessions, period), [sessions, period]);
  const { hidden, toggle } = useChartSeries();
  const description = `Concurrent sessions throughout ${formatDate(date)}`;
  return <AnalyticsChartPanel titleId="activity-by-time-title" eyebrow="Visual trend" title="Activity by Time" description={description} loading={loading} error={error} onRetry={onRetry} hasData={hasChartData(data)} hidden={hidden} onToggle={toggle} data={data} unit="sessions">
    <p className="sr-only">Maximum simultaneously active sessions during each hourly interval. Use the legend buttons to toggle a series and the accessible table for exact values.</p>
    <div className="business-chart" role="img" aria-label={`Activity by time line chart. ${description}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, left: 2, bottom: 6 }} accessibilityLayer>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={34} padding={{ left: 8, right: 8 }} />
          <YAxis allowDecimals={false} domain={[0, (maximum) => Math.max(1, Math.ceil(maximum))]} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={42} />
          <Tooltip content={<AnalyticsTooltip unit="activeSessions" />} cursor={{ stroke: "var(--chart-crosshair)", strokeWidth: 1 }} />
          {CHART_SERIES.map((series) => !hidden.has(series.key) && <Line key={series.key} type="linear" dataKey={series.key} name={series.label} stroke={CHART_COLORS[series.key]} strokeWidth={2.5} connectNulls={false} dot={{ r: 3, fill: "var(--chart-background)", stroke: CHART_COLORS[series.key], strokeWidth: 2 }} activeDot={{ r: 5, fill: "var(--chart-background)", stroke: CHART_COLORS[series.key], strokeWidth: 2 }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </AnalyticsChartPanel>;
}
