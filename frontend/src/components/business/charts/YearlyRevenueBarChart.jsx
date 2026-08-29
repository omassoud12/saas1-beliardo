import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "../../../utils/analytics";
import { buildRevenueSeries, hasChartData } from "../../../utils/chartData";
import { AnalyticsChartPanel, AnalyticsTooltip, ChartLegend, useChartSeries } from "./AnalyticsChartPanel";
import { CHART_COLORS, CHART_SERIES } from "./chartConfig";

const compact = (value, currency) => new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0));

function MonthTick({ x, y, payload, currentLabel }) {
  const current = payload.value === currentLabel;
  return <g transform={`translate(${x},${y})`}><text y={14} textAnchor="middle" fill={current ? "var(--text-soft)" : "var(--chart-axis)"} fontSize="11" fontWeight={current ? "700" : "400"}>{payload.value}</text>{current && <circle cy={23} r="2" fill="var(--chart-billiard)" />}</g>;
}

function barRadius(series, visibleSeries) {
  const first = visibleSeries[0]?.key;
  const last = visibleSeries[visibleSeries.length - 1]?.key;
  if (series.key === first && series.key === last) return [4, 4, 4, 4];
  if (series.key === last) return [4, 4, 0, 0];
  if (series.key === first) return [0, 0, 4, 4];
  return 0;
}

export function YearlyRevenueBarChart({ months = [], year, currency = "USD", businessDate = "", loading = false, error = null, onRetry }) {
  const currentYear = Number(businessDate.slice(0, 4));
  const currentMonth = Number(businessDate.slice(5, 7));
  const data = useMemo(() => buildRevenueSeries(months, (key) => formatMonth(Number(key.slice(0, 4)), Number(key.slice(5)), { month: "short" })).map((row, index) => {
    const month = index + 1;
    const isFuture = Number(year) > currentYear || (Number(year) === currentYear && month > currentMonth);
    return isFuture ? { ...row, playstation: 0, billiard: 0, pingpong: 0, total: 0, isFuture: true } : { ...row, isFuture: false };
  }), [months, year, currentYear, currentMonth]);
  const { hidden, toggle } = useChartSeries();
  const visibleSeries = CHART_SERIES.filter((series) => !hidden.has(series.key));
  const description = `Monthly revenue throughout ${year}`;
  const currentLabel = year === currentYear ? formatMonth(year, currentMonth, { month: "short" }) : "";
  const labelFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
  const renderTotalLabel = ({ x, y, width, index }) => {
    const row = data[index];
    if (!row) return null;
    const label = row.isFuture ? "-" : labelFormatter.format(row.total);
    return <text className="yearly-total-label" x={Number(x) + Number(width) / 2} y={Number(y) - 11} textAnchor="middle">{label}</text>;
  };
  return <AnalyticsChartPanel className="chart-panel--yearly-stacked" titleId="yearly-revenue-overview-title" eyebrow="Year at a glance" title="Yearly Revenue Overview" description={description} loading={loading} error={error} onRetry={onRetry} hasData={hasChartData(data)} hidden={hidden} onToggle={toggle} data={data} unit="currency" currency={currency} legend={false}>
    <div className="business-chart business-chart--year" role="img" aria-label={`Yearly revenue overview. ${description}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 46, right: 10, left: 0, bottom: 12 }} accessibilityLayer barCategoryGap="30%">
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} height={40} tick={<MonthTick currentLabel={currentLabel} />} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => compact(value, currency)} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={58} />
          <Tooltip content={<AnalyticsTooltip unit="currency" currency={currency} />} cursor={{ fill: "var(--chart-cursor)" }} />
          {visibleSeries.map((series, index) => <Bar key={series.key} dataKey={series.key} name={series.label} stackId="monthly-revenue" fill={CHART_COLORS[series.key]} radius={barRadius(series, visibleSeries)} maxBarSize={58} isAnimationActive={false}>
            {index === visibleSeries.length - 1 && <LabelList content={renderTotalLabel} />}
          </Bar>)}
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="yearly-chart-legend"><ChartLegend hidden={hidden} onToggle={toggle} /></div>
  </AnalyticsChartPanel>;
}
