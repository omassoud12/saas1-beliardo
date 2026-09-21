import { useState } from "react";
import { BusinessNavbar } from "../../components/business/BusinessNavbar";
import { DailySummary } from "./DailySummary";
import { MonthlySummary } from "./MonthlySummary";
import { YearlySummary } from "./YearlySummary";
import { BusinessReportExport } from "../../components/business/BusinessReportExport";
import { ActivityPerformance, BusinessEfficiencyStrip, BusinessOverview } from "../../components/business/BusinessAnalysisPanels";
import { BusinessPeriodHeader } from "../../components/business/BusinessPeriodHeader";
import { ExpenseManager } from "../../components/business/ExpenseManager";
import { TargetManager } from "../../components/business/TargetManager";
import { useBusinessAnalysis, useBusinessOverview } from "../../hooks/useBusinessSummary";
import { startOfWeek } from "../../utils/analytics";
import { WeeklySummary } from "./WeeklySummary";

const BUSINESS_THEME_KEY = "beliardo.business-theme";

function initialBusinessTheme() {
  if (typeof window === "undefined") return "dark";
  try { return window.localStorage.getItem(BUSINESS_THEME_KEY) === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}

export function BusinessAnalytics({ businessDate, businessId }) {
  const initialDate = businessDate;
  const [module, setModule] = useState("summary");
  const [period, setPeriod] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedWeek, setSelectedWeek] = useState(() => startOfWeek(initialDate));
  const [selectedMonth, setSelectedMonth] = useState(Number(initialDate.slice(5, 7)));
  const [selectedYear, setSelectedYear] = useState(Number(initialDate.slice(0, 4)));
  const [sessionPage, setSessionPage] = useState(1);
  const [theme, setTheme] = useState(initialBusinessTheme);

  const selectDate = (date) => {
    if (!date) return;
    setSelectedDate(date);
    setSelectedYear(Number(date.slice(0, 4)));
    setSelectedMonth(Number(date.slice(5, 7)));
    setSessionPage(1);
  };
  const selectMonth = (year, month) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };
  const parameters = period === "daily" ? { date: selectedDate, page: sessionPage, pageSize: 50 }
    : period === "weekly" ? { date: selectedWeek }
    : period === "monthly" ? { year: selectedYear, month: selectedMonth } : { year: selectedYear };
  const overviewQuery = useBusinessOverview(period, parameters, module === "summary", businessId);
  const standaloneAnalysisQuery = useBusinessAnalysis(period, parameters, module !== "summary", businessId);
  const analysisQuery = module === "summary"
    ? { ...overviewQuery, data: overviewQuery.data?.analysis ?? null }
    : standaloneAnalysisQuery;
  const summaryQuery = { ...overviewQuery, data: overviewQuery.data?.summary ?? null };
  const showSummaryDetails = module === "summary" && !analysisQuery.loading && !analysisQuery.error && Boolean(analysisQuery.data);
  const changeTheme = (nextTheme) => {
    setTheme(nextTheme);
    try { window.localStorage.setItem(BUSINESS_THEME_KEY, nextTheme); } catch { /* Theme still works for this visit. */ }
  };

  return (
    <section className={`business-analytics business-analytics--${theme}`}>
      <BusinessNavbar
        module={module}
        period={period}
        theme={theme}
        onModuleChange={setModule}
        onPeriodChange={setPeriod}
        onThemeChange={changeTheme}
        action={period !== "weekly" && <BusinessReportExport
          reportType={period}
          date={selectedDate}
          year={selectedYear}
          month={selectedMonth}
          theme={theme}
        />}
      />
      <div id="business-module-panel" role="tabpanel" aria-labelledby={`business-module-tab-${module}`}>
      <div id="business-period-panel" role="tabpanel" aria-labelledby={`business-period-tab-${period}`} tabIndex="0">
      <div className="business-view business-view--center-header"><BusinessPeriodHeader
        module={module} period={period} date={selectedDate} year={selectedYear} month={selectedMonth}
        weekStart={selectedWeek} businessDate={businessDate} onDateChange={selectDate} onWeekChange={setSelectedWeek}
        onMonthChange={selectMonth} onYearChange={setSelectedYear}
      />{module === "summary" && <><BusinessOverview query={analysisQuery} /><BusinessEfficiencyStrip query={analysisQuery} /></>}</div>
      {showSummaryDetails && period === "daily" && <DailySummary date={selectedDate} businessDate={businessDate} onDateChange={selectDate} showHeader={false} analysisQuery={analysisQuery} summaryQuery={summaryQuery} onSessionPageChange={setSessionPage} />}
      {showSummaryDetails && period === "monthly" && (
        <MonthlySummary
          year={selectedYear}
          month={selectedMonth}
          businessDate={businessDate}
          onPeriodChange={selectMonth}
          onSelectDay={(date) => { selectDate(date); setPeriod("daily"); }}
          showHeader={false}
          analysisQuery={analysisQuery}
          summaryQuery={summaryQuery}
        />
      )}
      {showSummaryDetails && period === "weekly" && <WeeklySummary analysisQuery={analysisQuery} />}
      {showSummaryDetails && period === "yearly" && (
        <YearlySummary
          year={selectedYear}
          businessDate={businessDate}
          onYearChange={setSelectedYear}
          onSelectMonth={(month) => { setSelectedMonth(month); setPeriod("monthly"); }}
          showHeader={false}
          analysisQuery={analysisQuery}
          summaryQuery={summaryQuery}
        />
      )}
      {module === "activity" && <ActivityPerformance query={analysisQuery} period={period} parameters={parameters} businessId={businessId} />}
      {module === "expenses" && <ExpenseManager businessDate={businessDate} analysisQuery={analysisQuery} businessId={businessId} />}
      {module === "targets" && <TargetManager businessDate={businessDate} analysisQuery={analysisQuery} businessId={businessId} />}
      </div>
      </div>
    </section>
  );
}
