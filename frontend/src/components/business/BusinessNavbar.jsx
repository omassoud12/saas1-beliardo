import { BUSINESS_COPY } from "../../content/businessCopy";
import { handleTabListKeyDown } from "../../utils/tabKeyboard";

export function BusinessNavbar({ module, period, theme, onModuleChange, onPeriodChange, onThemeChange, action }) {
  return (
    <nav className="business-nav" aria-label="Business analytics navigation">
      <div className="business-nav__main">
        <div className="business-nav__module-tabs" role="tablist" aria-label="Business Center modules" onKeyDown={handleTabListKeyDown}>
          {BUSINESS_COPY.modules.map(([value, label]) => <button key={value} id={`business-module-tab-${value}`} type="button" role="tab" aria-controls="business-module-panel" aria-selected={module === value} tabIndex={module === value ? 0 : -1} className={module === value ? "is-active" : ""} onClick={() => onModuleChange(value)}>{label}</button>)}
        </div>
        <div className="business-nav__tabs" role="tablist" aria-label="Business period" onKeyDown={handleTabListKeyDown}>
          {Object.entries(BUSINESS_COPY.periods).map(([item, label]) => (
            <button
              key={item}
              id={`business-period-tab-${item}`}
              type="button"
              role="tab"
              aria-controls="business-period-panel"
              aria-selected={period === item}
              tabIndex={period === item ? 0 : -1}
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
