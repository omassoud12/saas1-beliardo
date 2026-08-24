export function Header({ summary, view, onViewChange }) {
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
        <button
          type="button"
          className={view === "dashboard" ? "primary-nav__active" : ""}
          aria-current={view === "dashboard" ? "page" : undefined}
          onClick={() => onViewChange("dashboard")}
        >
          Dashboard
        </button>
      </nav>

      <dl className="hall-summary" aria-label="Hall status">
        <div>
          <dt>Stations</dt>
          <dd>{summary.total}</dd>
        </div>
        <div className="hall-summary__active">
          <dt>Active</dt>
          <dd>{summary.active}</dd>
        </div>
        <div className="hall-summary__paused">
          <dt>Paused</dt>
          <dd>{summary.paused}</dd>
        </div>
        <div>
          <dt>Available</dt>
          <dd>{summary.available}</dd>
        </div>
      </dl>
    </header>
  );
}
