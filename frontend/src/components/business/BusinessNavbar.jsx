const modules = [
  ["summary", "Summary · ملخص"], ["activity", "Activity · الأنشطة"],
  ["expenses", "Expenses · المصاريف"], ["targets", "Targets · الأهداف"],
];
const periods = { daily: "Daily · يومي", monthly: "Monthly · شهري", yearly: "Yearly · سنوي" };

export function BusinessNavbar({ module, period, theme, onModuleChange, onPeriodChange, onThemeChange, action }) {
  return (
    <nav className="business-nav" aria-label="Business analytics navigation">
      <div className="business-nav__main">
        <div className="business-nav__module-tabs" role="tablist" aria-label="Business Center modules">
          {modules.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={module === value} className={module === value ? "is-active" : ""} onClick={() => onModuleChange(value)}>{label}</button>)}
        </div>
        <div className="business-nav__tabs" role="tablist" aria-label="Business period">
          {Object.entries(periods).map(([item, label]) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={period === item}
              className={period === item ? "is-active" : ""}
              onClick={() => onPeriodChange(item)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="business-theme-toggle"
          type="button"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} Business Center theme`}
          aria-pressed={theme === "light"}
          onClick={() => onThemeChange(theme === "light" ? "dark" : "light")}
        >
          <span aria-hidden="true">{theme === "light" ? "☀" : "☾"}</span>
          {theme === "light" ? "Light · فاتح" : "Dark · داكن"}
        </button>
        {action}
      </div>
    </nav>
  );
}
