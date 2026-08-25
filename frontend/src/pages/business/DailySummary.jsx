import { ActivityBreakdown } from "../../components/business/ActivityBreakdown";
import { ActivityAreaChart } from "../../components/business/charts/ActivityAreaChart";
import { KpiGrid } from "../../components/business/KpiGrid";
import { PeriodNavigator } from "../../components/business/PeriodNavigator";
import { SessionTable } from "../../components/business/SessionTable";
import { useDailySummary } from "../../hooks/useBusinessSummary";
import { formatCurrency, formatDate, formatHours, shiftDate, todayKey } from "../../utils/analytics";

export function DailySummary({ date, onDateChange }) {
  const query = useDailySummary(date);
  const currentDate = todayKey();

  return (
    <div className="business-view">
      <header className="business-page-header">
        <div><p className="eyebrow">Business / Daily</p><h2>Daily Summary</h2><p>{formatDate(date)}</p></div>
        <PeriodNavigator
          label="day"
          currentLabel="Today"
          onPrevious={() => onDateChange(shiftDate(date, -1))}
          onNext={() => onDateChange(shiftDate(date, 1))}
          onCurrent={() => onDateChange(currentDate)}
        >
          <label className="date-picker"><span className="sr-only">Select summary date</span><input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label>
        </PeriodNavigator>
      </header>

      {query.loading || query.error
        ? <ActivityAreaChart date={date} loading={query.loading} error={query.error} onRetry={query.retry} />
        : <DailyContent data={query.data} date={date} />}
    </div>
  );
}

function DailyContent({ data, date }) {
  const metrics = data.metrics;
  const peakLabel = metrics.peakHour
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(new Date(`${metrics.peakHour}:00Z`))
    : "No peak yet";
  const total = {
    sessions: metrics.completedSessions,
    hours: metrics.totalHours,
    totalSeconds: metrics.totalSeconds,
    revenue: metrics.revenue,
  };
  return (
    <>
      <KpiGrid items={[
        { label: "Total Sessions", value: metrics.totalSessions, description: "Completed and currently open sessions", icon: "#" },
        { label: "Completed", value: metrics.completedSessions, description: "Sessions with a recorded end time", icon: "✓" },
        { label: "Total Hours", value: formatHours(metrics.totalHours), description: "Stored completed-session duration", icon: "h" },
        { label: "Peak Activity", value: `${metrics.peakActivity} sessions`, description: metrics.peakActivity ? `Busiest start hour: ${peakLabel}` : "No completed traffic yet", icon: "^" },
        { label: "Revenue", value: formatCurrency(metrics.revenue), description: "Completed-session revenue", icon: "$", emphasis: true },
      ]} />
      <ActivityBreakdown activities={data.activities} total={total} />
      <ActivityAreaChart sessions={data.concurrencySessions} period={data.period} date={date} />
      <SessionTable sessions={data.sessions} />
    </>
  );
}
