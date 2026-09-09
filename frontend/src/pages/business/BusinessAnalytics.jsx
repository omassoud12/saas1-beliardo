import { useState } from "react";
import { BusinessNavbar } from "../../components/business/BusinessNavbar";
import { DailySummary } from "./DailySummary";
import { MonthlySummary } from "./MonthlySummary";
import { YearlySummary } from "./YearlySummary";
import { BusinessReportExport } from "../../components/business/BusinessReportExport";
import { ActivityPerformance, BusinessOverview } from "../../components/business/BusinessAnalysisPanels";
import { BusinessPeriodHeader } from "../../components/business/BusinessPeriodHeader";
import { ExpenseManager } from "../../components/business/ExpenseManager";
import { TargetManager } from "../../components/business/TargetManager";
import { useBusinessAnalysis } from "../../hooks/useBusinessSummary";

const BUSINESS_THEME_KEY = "beliardo.business-theme";

function initialBusinessTheme() {
  if (typeof window === "undefined") return "dark";
  try { return window.localStorage.getItem(BUSINESS_THEME_KEY) === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}

export function BusinessAnalytics({ businessDate }) {
  const initialDate = businessDate;
  const [module, setModule] = useState("summary");
  const [period, setPeriod] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedMonth, setSelectedMonth] = useState(Number(initialDate.slice(5, 7)));
  const [selectedYear, setSelectedYear] = useState(Number(initialDate.slice(0, 4)));
  const [theme, setTheme] = useState(initialBusinessTheme);

  const selectDate = (date) => {
    if (!date) return;
    setSelectedDate(date);
    setSelectedYear(Number(date.slice(0, 4)));
    setSelectedMonth(Number(date.slice(5, 7)));
  };
  const selectMonth = (year, month) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };
  const parameters = period === "daily" ? { date: selectedDate }
    : period === "monthly" ? { year: selectedYear, month: selectedMonth } : { year: selectedYear };
  const analysisQuery = useBusinessAnalysis(period, parameters);
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
        action={<BusinessReportExport
          reportType={period}
          date={selectedDate}
          year={selectedYear}
          month={selectedMonth}
          theme={theme}
        />}
      />
      <div className="business-view business-view--center-header"><BusinessPeriodHeader
        module={module} period={period} date={selectedDate} year={selectedYear} month={selectedMonth}
        businessDate={businessDate} onDateChange={selectDate} onMonthChange={selectMonth} onYearChange={setSelectedYear}
      /><BusinessOverview query={analysisQuery} /></div>
      {module === "summary" && period === "daily" && <DailySummary date={selectedDate} businessDate={businessDate} onDateChange={selectDate} showHeader={false} analysisQuery={analysisQuery} />}
      {module === "summary" && period === "monthly" && (
        <MonthlySummary
          year={selectedYear}
          month={selectedMonth}
          businessDate={businessDate}
          onPeriodChange={selectMonth}
          onSelectDay={(date) => { selectDate(date); setPeriod("daily"); }}
          showHeader={false}
          analysisQuery={analysisQuery}
        />
      )}
      {module === "summary" && period === "yearly" && (
        <YearlySummary
          year={selectedYear}
          businessDate={businessDate}
          onYearChange={setSelectedYear}
          onSelectMonth={(month) => { setSelectedMonth(month); setPeriod("monthly"); }}
          showHeader={false}
          analysisQuery={analysisQuery}
        />
      )}
      {module === "activity" && <ActivityPerformance query={analysisQuery} />}
      {module === "expenses" && <ExpenseManager businessDate={businessDate} analysisQuery={analysisQuery} />}
      {module === "targets" && <TargetManager businessDate={businessDate} analysisQuery={analysisQuery} />}
    </section>
  );
}
