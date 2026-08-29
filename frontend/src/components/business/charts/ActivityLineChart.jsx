import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "../../../utils/analytics";
import { buildConcurrencyBuckets, hasChartData } from "../../../utils/chartData";
import { AnalyticsChartPanel, AnalyticsTooltip, ChartLegend, useChartSeries } from "./AnalyticsChartPanel";
import { CHART_SERIES } from "./chartConfig";

const ACTIVITY_COLORS = {
  playstation: "var(--activity-chart-playstation)",
  billiard: "var(--activity-chart-billiard)",
  pingpong: "var(--activity-chart-ping-pong)",
};

export function ActivityLineChart({ sessions = [], period, date, loading = false, error = null, onRetry }) {
  const data = useMemo(() => buildConcurrencyBuckets(sessions, period), [sessions, period]);
  const { hidden, toggle } = useChartSeries();
  const description = `${formatDate(date)} / 6:00 AM to 6:00 AM`;
  return <AnalyticsChartPanel className="chart-panel--activity-pulse" titleId="activity-by-time-title" eyebrow="Live pulse" title="Business Day Active Sessions" description={description} loading={loading} error={error} onRetry={onRetry} hasData={hasChartData(data)} hidden={hidden} onToggle={toggle} data={data} unit="sessions" legend={false}>
    <p className="sr-only">Maximum simultaneously active sessions during each hourly interval. Use the legend buttons to toggle a series and the accessible table for exact values.</p>
    <div className="business-chart" role="img" aria-label={`Activity by time area and line chart. ${description}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 18, right: 12, left: 2, bottom: 6 }} accessibilityLayer>
          <defs>
            {CHART_SERIES.map((series) => <linearGradient key={series.key} id={`activity-fill-${series.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACTIVITY_COLORS[series.key]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={ACTIVITY_COLORS[series.key]} stopOpacity={0.025} />
            </linearGradient>)}
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={46} padding={{ left: 8, right: 8 }} />
          <YAxis allowDecimals={false} domain={[0, (maximum) => Math.max(1, Math.ceil(maximum))]} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={42} />
          <Tooltip content={<AnalyticsTooltip unit="activeSessions" />} cursor={{ stroke: "var(--chart-crosshair)", strokeWidth: 1 }} />
          {CHART_SERIES.map((series) => !hidden.has(series.key) && <Area key={series.key} type="linear" dataKey={series.key} name={series.label} stroke={ACTIVITY_COLORS[series.key]} strokeWidth={3} fill={`url(#activity-fill-${series.key})`} connectNulls={false} dot={{ r: 4, fill: ACTIVITY_COLORS[series.key], fillOpacity: 0.3, stroke: ACTIVITY_COLORS[series.key], strokeWidth: 2 }} activeDot={{ r: 6, fill: "var(--chart-background)", stroke: ACTIVITY_COLORS[series.key], strokeWidth: 3 }} isAnimationActive={false} />)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
    <ChartLegend hidden={hidden} onToggle={toggle} />
  </AnalyticsChartPanel>;
}
