import { useState } from "react";
import { BusinessNavbar } from "../../components/business/BusinessNavbar";
import { DailySummary } from "./DailySummary";
import { MonthlySummary } from "./MonthlySummary";
import { YearlySummary } from "./YearlySummary";
import { BusinessReportExport } from "../../components/business/BusinessReportExport";

export function BusinessAnalytics({ businessDate, onBack }) {
  const initialDate = businessDate;
  const [section, setSection] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedMonth, setSelectedMonth] = useState(Number(initialDate.slice(5, 7)));
  const [selectedYear, setSelectedYear] = useState(Number(initialDate.slice(0, 4)));

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

  return (
    <section className="business-analytics">
      <BusinessNavbar
        section={section}
        onBack={onBack}
        onSectionChange={setSection}
        action={<BusinessReportExport
          reportType={section}
          date={selectedDate}
          year={selectedYear}
          month={selectedMonth}
        />}
      />
      {section === "daily" && <DailySummary date={selectedDate} businessDate={businessDate} onDateChange={selectDate} />}
      {section === "monthly" && (
        <MonthlySummary
          year={selectedYear}
          month={selectedMonth}
          businessDate={businessDate}
          onPeriodChange={selectMonth}
          onSelectDay={(date) => { selectDate(date); setSection("daily"); }}
        />
      )}
      {section === "yearly" && (
        <YearlySummary
          year={selectedYear}
          businessDate={businessDate}
          onYearChange={setSelectedYear}
          onSelectMonth={(month) => { setSelectedMonth(month); setSection("monthly"); }}
        />
      )}
    </section>
  );
}
