import { useState } from "react";
import { BusinessNavbar } from "../../components/business/BusinessNavbar";
import { todayKey } from "../../utils/analytics";
import { DailySummary } from "./DailySummary";
import { MonthlySummary } from "./MonthlySummary";
import { YearlySummary } from "./YearlySummary";

export function BusinessAnalytics({ onBack }) {
  const initialDate = todayKey();
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
      <BusinessNavbar section={section} onBack={onBack} onSectionChange={setSection} />
      {section === "daily" && <DailySummary date={selectedDate} onDateChange={selectDate} />}
      {section === "monthly" && (
        <MonthlySummary
          year={selectedYear}
          month={selectedMonth}
          onPeriodChange={selectMonth}
          onSelectDay={(date) => { selectDate(date); setSection("daily"); }}
        />
      )}
      {section === "yearly" && (
        <YearlySummary
          year={selectedYear}
          onYearChange={setSelectedYear}
          onSelectMonth={(month) => { setSelectedMonth(month); setSection("monthly"); }}
        />
      )}
    </section>
  );
}
