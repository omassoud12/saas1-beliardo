import { ActivityBreakdown } from "../../components/business/ActivityBreakdown";
import { MonthlyRevenueChart } from "../../components/business/charts/MonthlyRevenueChart";
import { KpiGrid } from "../../components/business/KpiGrid";
import { MonthlyCalendar } from "../../components/business/MonthlyCalendar";
import { PeriodNavigator } from "../../components/business/PeriodNavigator";
import { useMonthlySummary } from "../../hooks/useBusinessSummary";
import { formatHours, formatMonth } from "../../utils/analytics";
import { BusinessComparisonsAndInsights, BusinessPlanningSnapshot, MonthlyRevenueGrowth } from "../../components/business/BusinessAnalysisPanels";

export function MonthlySummary({ year, month, businessDate, onPeriodChange, onSelectDay, showHeader = true, analysisQuery }) {
  const query = useMonthlySummary(year, month);
  const move = (amount) => {
    const value = new Date(Date.UTC(year, month - 1 + amount, 1));
    onPeriodChange(value.getUTCFullYear(), value.getUTCMonth() + 1);
  };
  const currentYear = Number(businessDate.slice(0, 4));
  const currentMonth = Number(businessDate.slice(5, 7));

  return (
    <div className="business-view">
      {showHeader && <header className="business-page-header">
        <div><p className="eyebrow">Business / Monthly</p><h2>Monthly Summary</h2><p>{formatMonth(year, month)}</p></div>
        <PeriodNavigator label="month" currentLabel="Current month" onPrevious={() => move(-1)} onNext={() => move(1)} onCurrent={() => onPeriodChange(currentYear, currentMonth)}>
          <strong>{formatMonth(year, month)}</strong>
        </PeriodNavigator>
      </header>}
      {analysisQuery && <BusinessPlanningSnapshot query={analysisQuery} />}
      {analysisQuery && <MonthlyRevenueGrowth query={analysisQuery} />}
      {query.loading || query.error ? <MonthlyRevenueChart year={year} month={month} loading={query.loading} error={query.error} onRetry={query.retry} /> : (
        <MonthlyContent data={query.data} year={year} month={month} onSelectDay={onSelectDay} analysisQuery={analysisQuery} />
      )}
    </div>
  );
}

function MonthlyContent({ data, year, month, onSelectDay, analysisQuery }) {
  const metrics = data.metrics;
  const total = { sessions: metrics.sessionCount, hours: metrics.totalHours, totalSeconds: metrics.totalSeconds, revenue: metrics.revenue };
  return (
    <>
      <KpiGrid eyebrow="Operations · التشغيل" title="Month activity · نشاط الشهر" items={[
        { label: "Tracked Days · الأيام المسجلة", value: metrics.trackedDays, description: "Days with completed activity · أيام فيها نشاط مكتمل", icon: "#" },
        { label: "Sessions · الجلسات", value: metrics.sessionCount, description: "Completed this month · المكتملة هذا الشهر", icon: "✓" },
        { label: "Monthly Hours · ساعات الشهر", value: formatHours(metrics.totalHours), description: "Combined completed usage · إجمالي الاستخدام المكتمل", icon: "h" },
      ]} />
      <ActivityBreakdown activities={data.activities} total={total} />
      <MonthlyCalendar year={year} month={month} days={data.days} onSelectDay={onSelectDay} />
      <MonthlyRevenueChart days={data.days} period={data.period} year={year} month={month} currency={data.period.currency} />
      {analysisQuery && <BusinessComparisonsAndInsights query={analysisQuery} />}
    </>
  );
}
