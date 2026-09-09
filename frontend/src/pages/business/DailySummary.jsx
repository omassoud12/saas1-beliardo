import { ActivityBreakdown } from "../../components/business/ActivityBreakdown";
import { ActivityLineChart } from "../../components/business/charts/ActivityLineChart";
import { KpiGrid } from "../../components/business/KpiGrid";
import { PeriodNavigator } from "../../components/business/PeriodNavigator";
import { SessionTable } from "../../components/business/SessionTable";
import { useDailySummary } from "../../hooks/useBusinessSummary";
import { formatDate, formatHours, shiftDate } from "../../utils/analytics";
import { BusinessComparisonsAndInsights, BusinessPlanningSnapshot } from "../../components/business/BusinessAnalysisPanels";

export function DailySummary({ date, businessDate, onDateChange, showHeader = true, analysisQuery }) {
  const query = useDailySummary(date);

  return (
    <div className="business-view">
      {showHeader && <header className="business-page-header">
        <div><p className="eyebrow">Business / Daily</p><h2>Daily Summary</h2><p>{formatDate(date)}</p></div>
        <PeriodNavigator
          label="day"
          currentLabel="Today"
          onPrevious={() => onDateChange(shiftDate(date, -1))}
          onNext={() => onDateChange(shiftDate(date, 1))}
          onCurrent={() => onDateChange(businessDate)}
        >
          <label className="date-picker"><span className="sr-only">Select summary date</span><input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label>
        </PeriodNavigator>
      </header>}

      {analysisQuery && <BusinessPlanningSnapshot query={analysisQuery} />}

      {query.loading || query.error
        ? <ActivityLineChart date={date} loading={query.loading} error={query.error} onRetry={query.retry} />
        : <DailyContent data={query.data} date={date} analysisQuery={analysisQuery} />}
    </div>
  );
}

function DailyContent({ data, date, analysisQuery }) {
  const metrics = data.metrics;
  const peakLabel = metrics.peakHour
    ? new Intl.DateTimeFormat("en-US", { timeZone: data.period.timezone, hour: "numeric" }).format(new Date(`${metrics.peakHour}:00Z`))
    : "No peak yet";
  const total = {
    sessions: metrics.completedSessions,
    hours: metrics.totalHours,
    totalSeconds: metrics.totalSeconds,
    revenue: metrics.revenue,
  };
  return (
    <>
      <KpiGrid eyebrow="Operations · التشغيل" title="Today's activity · نشاط اليوم" items={[
        { label: "Total Sessions · إجمالي الجلسات", value: metrics.totalSessions, description: "Completed and currently open · المكتملة والمفتوحة حالياً", icon: "#" },
        { label: "Completed · المكتملة", value: metrics.completedSessions, description: "Sessions with a recorded end time · جلسات لها وقت انتهاء", icon: "✓" },
        { label: "Total Hours · إجمالي الساعات", value: formatHours(metrics.totalHours), description: "Completed usage · مدة الاستخدام المكتملة", icon: "h" },
        { label: "Peak Activity · وقت الذروة", value: `${metrics.peakActivity} sessions`, description: metrics.peakActivity ? `Busiest completion hour: ${peakLabel}` : "No completed traffic yet · لا توجد حركة مكتملة", icon: "^" },
      ]} />
      <ActivityBreakdown activities={data.activities} total={total} />
      <ActivityLineChart sessions={data.concurrencySessions} period={data.period} date={date} />
      <SessionTable sessions={data.sessions} timezone={data.period.timezone} />
      {analysisQuery && <BusinessComparisonsAndInsights query={analysisQuery} />}
    </>
  );
}
