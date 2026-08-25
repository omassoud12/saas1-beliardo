import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "../../../utils/analytics";
import { buildConcurrencyBuckets, hasChartData } from "../../../utils/chartData";
import { AnalyticsChartPanel, AnalyticsTooltip, useChartSeries } from "./AnalyticsChartPanel";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

export function ActivityAreaChart({ sessions = [], period, date, loading = false, error = null, onRetry }) {
  const data = useMemo(() => buildConcurrencyBuckets(sessions, period), [sessions, period]);
  const { hidden, toggle } = useChartSeries();
  const description = `Concurrent sessions throughout ${formatDate(date)}`;
  return <AnalyticsChartPanel titleId="activity-by-time-title" title="Activity by Time" description={description} loading={loading} error={error} onRetry={onRetry} hasData={hasChartData(data)} hidden={hidden} onToggle={toggle} data={data} unit="sessions">
    <p className="sr-only">Maximum simultaneous sessions during each hourly interval. Paused live sessions stop at their recorded pause time.</p>
    <div className="business-chart" role="img" aria-label={`Activity by time. ${description}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 14, right: 10, left: -12, bottom: 4 }} accessibilityLayer>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} interval={2} minTickGap={18} />
          <YAxis allowDecimals={false} domain={[0, "auto"]} axisLine={false} tickLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={44} />
          <Tooltip content={<AnalyticsTooltip unit="sessions" />} cursor={{ stroke: "var(--chart-crosshair)", strokeWidth: 1 }} />
          {CHART_SERIES.map((series) => !hidden.has(series.key) && <Line key={series.key} type="stepAfter" dataKey={series.key} name={series.label} stroke={CHART_COLORS[series.key]} strokeWidth={2.4} dot={{ r: 2.5, strokeWidth: 1.5, fill: "var(--chart-tooltip-bg)" }} activeDot={{ r: 5, strokeWidth: 2 }} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </AnalyticsChartPanel>;
}
