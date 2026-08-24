export function AnalyticsLoading() {
  return (
    <div className="analytics-skeleton" aria-label="Loading business analytics" aria-busy="true">
      <div className="skeleton-line skeleton-line--title" />
      <div className="skeleton-grid">{[1, 2, 3, 4].map((item) => <div className="skeleton-card" key={item} />)}</div>
      <div className="skeleton-panel" />
      <div className="skeleton-panel skeleton-panel--tall" />
    </div>
  );
}

export function AnalyticsError({ onRetry }) {
  return (
    <div className="analytics-empty analytics-error" role="alert">
      <span aria-hidden="true">!</span>
      <h3>Unable to load business analytics</h3>
      <p>Check your connection and authentication, then try again.</p>
      <button className="button button--primary" type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}
