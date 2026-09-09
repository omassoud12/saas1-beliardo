import { PeriodNavigator } from "./PeriodNavigator";
import { formatDate, formatMonth } from "../../utils/analytics";

export function BusinessPeriodHeader({ module, period, date, year, month, businessDate, onDateChange, onMonthChange, onYearChange }) {
  const currentYear = Number(businessDate.slice(0, 4));
  const currentMonth = Number(businessDate.slice(5, 7));
  const moveMonth = (amount) => {
    const value = new Date(Date.UTC(year, month - 1 + amount, 1));
    onMonthChange(value.getUTCFullYear(), value.getUTCMonth() + 1);
  };
  const shiftDay = (amount) => {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + amount);
    onDateChange(value.toISOString().slice(0, 10));
  };
  const label = period === "daily" ? formatDate(date) : period === "monthly" ? formatMonth(year, month) : String(year);
  const titles = {
    summary: ["Summary", "ملخص العمل"], activity: ["Activity Performance", "أداء الأنشطة"],
    expenses: ["Expenses", "المصاريف"], targets: ["Targets", "الأهداف"],
  };
  return <header className="business-page-header">
    <div><p className="eyebrow">Business Center · مركز الأعمال</p><h2>{titles[module][0]} <span lang="ar" dir="rtl">· {titles[module][1]}</span></h2><p>{label}</p></div>
    {period === "daily" ? <PeriodNavigator label="day" currentLabel="Today" onPrevious={() => shiftDay(-1)} onNext={() => shiftDay(1)} onCurrent={() => onDateChange(businessDate)}><label className="date-picker"><span className="sr-only">Select business date</span><input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} /></label></PeriodNavigator>
      : period === "monthly" ? <PeriodNavigator label="month" currentLabel="Current month" onPrevious={() => moveMonth(-1)} onNext={() => moveMonth(1)} onCurrent={() => onMonthChange(currentYear, currentMonth)}><strong>{formatMonth(year, month)}</strong></PeriodNavigator>
        : <PeriodNavigator label="year" currentLabel="Current year" onPrevious={() => onYearChange(year - 1)} onNext={() => onYearChange(year + 1)} onCurrent={() => onYearChange(currentYear)}><strong>{year}</strong></PeriodNavigator>}
  </header>;
}
