import { formatCurrency, formatDate, formatHours } from "../../utils/analytics";

export function MonthlyCalendar({ year, month, days, onSelectDay }) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const leading = (firstDay.getUTCDay() + 6) % 7;
  const maxRevenue = Math.max(...days.map((day) => day.total.revenue), 0);
  const cells = [...Array.from({ length: leading }, () => null), ...days];

  return (
    <section className="analytics-panel calendar-panel" aria-labelledby="daily-totals-title">
      <div className="analytics-panel__heading">
        <div><p className="eyebrow">Day-by-day</p><h3 id="daily-totals-title">Daily totals calendar</h3></div>
        <p>Select any day to open its complete session summary.</p>
      </div>
      <div className="business-calendar" role="grid" aria-label="Monthly business totals">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
        {cells.map((day, index) => day ? (
          <button
            type="button"
            role="gridcell"
            key={day.key}
            className={day.total.sessions ? "calendar-day has-activity" : "calendar-day"}
            style={{ "--intensity": maxRevenue ? 0.08 + (day.total.revenue / maxRevenue) * 0.2 : 0 }}
            onClick={() => onSelectDay(day.key)}
            aria-label={`${formatDate(day.key)}: ${day.total.sessions} sessions, ${formatHours(day.total.hours)}, ${formatCurrency(day.total.revenue)}`}
            title={`${formatDate(day.key)}\n${formatHours(day.total.hours)} · ${formatCurrency(day.total.revenue)}`}
          >
            <span className="calendar-day__number">{Number(day.key.slice(-2))}</span>
            {day.total.sessions ? <><strong>{formatCurrency(day.total.revenue)}</strong><small>{formatHours(day.total.hours)}</small></> : <small>No activity</small>}
          </button>
        ) : <div className="calendar-day calendar-day--empty" aria-hidden="true" key={`empty-${index}`} />)}
      </div>
    </section>
  );
}
