import { ActivityBreakdown } from "../../components/business/ActivityBreakdown";
import { AnalyticsError, AnalyticsLoading } from "../../components/business/AnalyticsStates";
import { KpiGrid } from "../../components/business/KpiGrid";
import { PeriodNavigator } from "../../components/business/PeriodNavigator";
import { TrendChart } from "../../components/business/TrendChart";
import { useYearlySummary } from "../../hooks/useBusinessSummary";
import { ACTIVITY_META, formatCurrency, formatHours, formatMonth } from "../../utils/analytics";

export function YearlySummary({ year, onYearChange, onSelectMonth }) {
  const query = useYearlySummary(year);
  const currentYear = new Date().getFullYear();
  return (
    <div className="business-view">
      <header className="business-page-header">
        <div><p className="eyebrow">Business / Yearly</p><h2>Yearly Summary</h2><p>{year}</p></div>
        <PeriodNavigator label="year" currentLabel="Current year" onPrevious={() => onYearChange(year - 1)} onNext={() => onYearChange(year + 1)} onCurrent={() => onYearChange(currentYear)}>
          <strong>{year}</strong>
        </PeriodNavigator>
      </header>
      {query.loading ? <AnalyticsLoading /> : query.error ? <AnalyticsError onRetry={query.retry} /> : (
        <YearlyContent data={query.data} year={year} onSelectMonth={onSelectMonth} />
      )}
    </div>
  );
}

function YearlyContent({ data, year, onSelectMonth }) {
  const metrics = data.metrics;
  const total = { sessions: metrics.sessionCount, hours: metrics.totalHours, totalSeconds: metrics.totalSeconds, revenue: metrics.revenue };
  return (
    <>
      <KpiGrid items={[
        { label: "Tracked Days", value: metrics.trackedDays, description: "Unique days with completed activity", icon: "#" },
        { label: "Sessions", value: metrics.sessionCount, description: "Completed sessions this year", icon: "✓" },
        { label: "Yearly Hours", value: formatHours(metrics.totalHours), description: "Combined completed usage", icon: "h" },
        { label: "Yearly Revenue", value: formatCurrency(metrics.revenue), description: "Revenue recognized this year", icon: "$", emphasis: true },
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
                {item.activities.map((activity) => <span key={activity.type}><i className={`activity-dot activity-dot--${activity.type}`} />{ACTIVITY_META[activity.type].short} {formatCurrency(activity.revenue)}</span>)}
              </div>
              <em>View month &rarr;</em>
            </button>
          ))}
        </div>
      </section>
      <TrendChart title="Yearly Revenue Trend" subtitle={`Monthly revenue throughout ${year}`} data={data.months} labelFormatter={(key) => formatMonth(Number(key.slice(0, 4)), Number(key.slice(5)), { month: "short" })} />
    </>
  );
}
