export function Header({ summary, view, onViewChange, permissions }) {
  const summaryValue = (value) => value === null
    ? <span className="hall-summary__loading" aria-label="Loading">&nbsp;</span>
    : value;

  return (
    <header className="app-header">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="eyebrow">Billiard Hall</p>
          <h1>Hall operations</h1>
        </div>
      </div>

      <nav className="primary-nav" aria-label="Primary navigation">
        <button
          type="button"
          className={view === "home" ? "primary-nav__active" : ""}
          aria-current={view === "home" ? "page" : undefined}
          onClick={() => onViewChange("home")}
        >
          Home
        </button>
        {permissions.viewAnalytics && <button
          type="button"
          className={view === "dashboard" ? "primary-nav__active" : ""}
          aria-current={view === "dashboard" ? "page" : undefined}
          onClick={() => onViewChange("dashboard")}
        >
          Dashboard
        </button>}
        {permissions.manageEmployees && <button type="button" className={view === "employees" ? "primary-nav__active" : ""} aria-current={view === "employees" ? "page" : undefined} onClick={() => onViewChange("employees")}>Employees</button>}
        {permissions.viewAnalytics && <button
          type="button"
          className={view === "business" ? "primary-nav__active" : ""}
          aria-current={view === "business" ? "page" : undefined}
          onClick={() => onViewChange("business")}
        >
          Business
        </button>}
      </nav>

      <dl className="hall-summary" aria-label="Hall status">
        <div>
          <dt>Stations</dt>
          <dd>{summaryValue(summary.total)}</dd>
        </div>
        <div className="hall-summary__active">
          <dt>Active</dt>
          <dd>{summaryValue(summary.active)}</dd>
        </div>
        <div className="hall-summary__paused">
          <dt>Paused</dt>
          <dd>{summaryValue(summary.paused)}</dd>
        </div>
        <div>
          <dt>Available</dt>
          <dd>{summaryValue(summary.available)}</dd>
        </div>
        <div className="hall-summary__finished">
          <dt>Finished</dt>
          <dd>{summaryValue(summary.finished)}</dd>
        </div>
      </dl>
    </header>
  );
}
