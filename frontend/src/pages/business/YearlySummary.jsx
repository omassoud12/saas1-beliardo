import { ActivityBreakdown } from "../../components/business/ActivityBreakdown";
import { YearlyRevenueBarChart } from "../../components/business/charts/YearlyRevenueBarChart";
import { KpiGrid } from "../../components/business/KpiGrid";
import { PeriodNavigator } from "../../components/business/PeriodNavigator";
import { useYearlySummary } from "../../hooks/useBusinessSummary";
import { ACTIVITY_META, formatCurrency, formatHours, formatMonth } from "../../utils/analytics";
import { BusinessComparisonsAndInsights, BusinessPlanningSnapshot } from "../../components/business/BusinessAnalysisPanels";

export function YearlySummary({ year, businessDate, onYearChange, onSelectMonth, showHeader = true, analysisQuery }) {
  const query = useYearlySummary(year);
  const currentYear = Number(businessDate.slice(0, 4));
  return (
    <div className="business-view">
      {showHeader && <header className="business-page-header">
        <div><p className="eyebrow">Business / Yearly</p><h2>Yearly Summary</h2><p>{year}</p></div>
        <PeriodNavigator label="year" currentLabel="Current year" onPrevious={() => onYearChange(year - 1)} onNext={() => onYearChange(year + 1)} onCurrent={() => onYearChange(currentYear)}>
          <strong>{year}</strong>
        </PeriodNavigator>
      </header>}
      {analysisQuery && <BusinessPlanningSnapshot query={analysisQuery} />}
      {query.loading || query.error ? <YearlyRevenueBarChart year={year} loading={query.loading} error={query.error} onRetry={query.retry} /> : (
        <YearlyContent data={query.data} year={year} onSelectMonth={onSelectMonth} analysisQuery={analysisQuery} />
      )}
    </div>
  );
}

function YearlyContent({ data, year, onSelectMonth, analysisQuery }) {
  const metrics = data.metrics;
  const total = { sessions: metrics.sessionCount, hours: metrics.totalHours, totalSeconds: metrics.totalSeconds, revenue: metrics.revenue };
  return (
    <>
      <KpiGrid eyebrow="Operations · التشغيل" title="Year activity · نشاط السنة" items={[
        { label: "Tracked Days · الأيام المسجلة", value: metrics.trackedDays, description: "Unique days with activity · أيام فيها نشاط مكتمل", icon: "#" },
        { label: "Sessions · الجلسات", value: metrics.sessionCount, description: "Completed this year · المكتملة هذه السنة", icon: "✓" },
        { label: "Yearly Hours · ساعات السنة", value: formatHours(metrics.totalHours), description: "Combined completed usage · إجمالي الاستخدام المكتمل", icon: "h" },
      ]} />
      <ActivityBreakdown activities={data.activities} total={total} />
      <section className="analytics-panel yearly-months" aria-labelledby="month-summary-title">
        <div className="analytics-panel__heading"><div><p className="eyebrow">Year at a glance</p><h3 id="month-summary-title">Monthly summary</h3></div><p>Select a month to inspect its daily performance.</p></div>
        <div className="yearly-month-grid">
          {data.months.map((item, index) => (
            <button type="button" key={item.key} onClick={() => onSelectMonth(index + 1)} aria-label={`Open ${formatMonth(year, index + 1)} summary`}>
              <span>{formatMonth(year, index + 1, { month: "long" })}</span>
              <strong>{formatCurrency(item.total.revenue)}</strong>
              <small>{formatHours(item.total.hours)} · {item.total.sessions} sessions</small>
              <div className="month-activity-mini">
                {item.activities.map((activity) => <span key={activity.type}><i className={`activity-dot activity-dot--${activity.type}`} />{ACTIVITY_META[activity.type]?.short ?? activity.label} {formatCurrency(activity.revenue)}</span>)}
              </div>
              <em>View month &rarr;</em>
            </button>
          ))}
        </div>
      </section>
      <YearlyRevenueBarChart months={data.months} year={year} currency={data.period.currency} businessDate={data.period.businessDate} />
      {analysisQuery && <BusinessComparisonsAndInsights query={analysisQuery} />}
    </>
  );
}
