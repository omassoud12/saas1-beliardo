import { ActivityLineChart } from "../../components/business/charts/ActivityLineChart";
import { KpiGrid } from "../../components/business/KpiGrid";
import { PeriodNavigator } from "../../components/business/PeriodNavigator";
import { SessionTable } from "../../components/business/SessionTable";
import { formatDate, formatHours, shiftDate } from "../../utils/analytics";
import { BusinessComparisonsAndInsights, BusinessPlanningSnapshot } from "../../components/business/BusinessAnalysisPanels";
import { FinancialTrendChart } from "../../components/business/charts/FinancialTrendChart";

export function DailySummary({ date, businessDate, onDateChange, showHeader = true, analysisQuery, summaryQuery, onSessionPageChange }) {
  const query = summaryQuery;
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
      {analysisQuery && <FinancialTrendChart query={analysisQuery} />}

      {query.loading || query.error
        ? <ActivityLineChart date={date} loading={query.loading} error={query.error} onRetry={query.retry} />
        : <DailyContent data={query.data} date={date} analysisQuery={analysisQuery} onSessionPageChange={onSessionPageChange} />}
    </div>
  );
}

function DailyContent({ data, date, analysisQuery, onSessionPageChange }) {
  const metrics = data.metrics;
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const concurrencySessions = Array.isArray(data.concurrencySessions) ? data.concurrencySessions : [];
  const peakLabel = metrics.peakHour
    ? new Intl.DateTimeFormat("en-US", { timeZone: data.period.timezone, hour: "numeric" }).format(new Date(`${metrics.peakHour}:00Z`))
    : "No peak yet";
  return (
    <>
      <KpiGrid eyebrow="Operations · التشغيل" title="Today's activity · نشاط اليوم" items={[
        { label: "Total Sessions · إجمالي الجلسات", value: metrics.totalSessions, description: "Completed and currently open · المكتملة والمفتوحة حالياً", icon: "#" },
        { label: "Total Hours · إجمالي الساعات", value: formatHours(metrics.totalHours), description: "Completed usage · مدة الاستخدام المكتملة", icon: "h" },
        { label: "Peak Activity · وقت الذروة", value: `${metrics.peakActivity} sessions`, description: metrics.peakActivity ? `Busiest completion hour: ${peakLabel}` : "No completed traffic yet · لا توجد حركة مكتملة", icon: "^" },
      ]} />
      <ActivityLineChart sessions={concurrencySessions} period={data.period} date={date} metrics={metrics} />
      <SessionTable sessions={sessions} timezone={data.period.timezone} pagination={data.sessionPagination} onPageChange={onSessionPageChange} />
      {analysisQuery && <BusinessComparisonsAndInsights query={analysisQuery} />}
    </>
  );
}
