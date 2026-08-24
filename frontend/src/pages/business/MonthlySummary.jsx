import { ActivityBreakdown } from "../../components/business/ActivityBreakdown";
import { AnalyticsError, AnalyticsLoading } from "../../components/business/AnalyticsStates";
import { KpiGrid } from "../../components/business/KpiGrid";
import { MonthlyCalendar } from "../../components/business/MonthlyCalendar";
import { PeriodNavigator } from "../../components/business/PeriodNavigator";
import { TrendChart } from "../../components/business/TrendChart";
import { useMonthlySummary } from "../../hooks/useBusinessSummary";
import { formatCurrency, formatHours, formatMonth } from "../../utils/analytics";

export function MonthlySummary({ year, month, onPeriodChange, onSelectDay }) {
  const query = useMonthlySummary(year, month);
  const move = (amount) => {
    const value = new Date(Date.UTC(year, month - 1 + amount, 1));
    onPeriodChange(value.getUTCFullYear(), value.getUTCMonth() + 1);
  };
  const current = new Date();

  return (
    <div className="business-view">
      <header className="business-page-header">
        <div><p className="eyebrow">Business / Monthly</p><h2>Monthly Summary</h2><p>{formatMonth(year, month)}</p></div>
        <PeriodNavigator label="month" currentLabel="Current month" onPrevious={() => move(-1)} onNext={() => move(1)} onCurrent={() => onPeriodChange(current.getFullYear(), current.getMonth() + 1)}>
          <strong>{formatMonth(year, month)}</strong>
        </PeriodNavigator>
      </header>
      {query.loading ? <AnalyticsLoading /> : query.error ? <AnalyticsError onRetry={query.retry} /> : (
        <MonthlyContent data={query.data} year={year} month={month} onSelectDay={onSelectDay} />
      )}
    </div>
  );
}

function MonthlyContent({ data, year, month, onSelectDay }) {
  const metrics = data.metrics;
  const total = { sessions: metrics.sessionCount, hours: metrics.totalHours, totalSeconds: metrics.totalSeconds, revenue: metrics.revenue };
  return (
    <>
      <KpiGrid items={[
        { label: "Tracked Days", value: metrics.trackedDays, description: "Days with completed activity", icon: "#" },
        { label: "Sessions", value: metrics.sessionCount, description: "Completed sessions this month", icon: "✓" },
        { label: "Monthly Hours", value: formatHours(metrics.totalHours), description: "Combined completed usage", icon: "h" },
        { label: "Monthly Revenue", value: formatCurrency(metrics.revenue), description: "Revenue recognized this month", icon: "$", emphasis: true },
      ]} />
      <ActivityBreakdown activities={data.activities} total={total} />
      <MonthlyCalendar year={year} month={month} days={data.days} onSelectDay={onSelectDay} />
      <TrendChart
        title="Monthly Revenue Movement"
        subtitle={`Daily revenue throughout ${formatMonth(year, month)}`}
        data={data.days}
        labelFormatter={(key) => String(Number(key.slice(-2)))}
      />
    </>
  );
}
