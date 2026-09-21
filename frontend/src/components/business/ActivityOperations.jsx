import { formatCurrency, formatDuration } from "../../utils/analytics";
import { AnalyticsError, AnalyticsLoading } from "./AnalyticsStates";
import { BUSINESS_COPY } from "../../content/businessCopy";

function comparisonLabel(comparison) {
  if (!comparison) return "—";
  if (comparison.percentageDifference === null) return comparison.current > 0 ? "New vs previous period" : "No change";
  const value = Number(comparison.percentageDifference);
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function duration(minutes) {
  return minutes === null || minutes === undefined ? "—" : formatDuration(Number(minutes) * 60);
}

function ActivityCards({ activities }) {
  return <div className="activity-mobile-cards">{activities.map((item) => <article key={item.type}>
    <h4><span className={`activity-dot activity-dot--${item.type}`} />{item.label}</h4>
    <dl><div><dt>{BUSINESS_COPY.metrics.revenue}</dt><dd>{formatCurrency(item.revenue)}</dd></div><div><dt>Sessions</dt><dd>{item.sessions}</dd></div><div><dt>Avg. value</dt><dd>{item.averageSessionValue === null ? "—" : formatCurrency(item.averageSessionValue)}</dd></div><div><dt>Avg. duration</dt><dd>{duration(item.averageSessionDurationMinutes)}</dd></div><div><dt>{BUSINESS_COPY.metrics.revenuePerHour}</dt><dd>{item.revenuePerHour === null ? "—" : formatCurrency(item.revenuePerHour)}</dd></div><div><dt>Previous period</dt><dd>{comparisonLabel(item.revenueComparison)}</dd></div></dl>
  </article>)}</div>;
}

export function ActivityOperations({ activities }) {
  const populated = activities.filter((item) => item.sessions > 0 || item.revenue > 0);
  return <section className="analytics-panel activity-operations" aria-labelledby="activity-operations-title">
    <div className="analytics-panel__heading"><div><p className="eyebrow">Operational comparison · مقارنة تشغيلية</p><h3 id="activity-operations-title">Performance by activity · الأداء حسب النشاط</h3></div><p>Compare demand, session economics and efficiency—not overall business totals.</p></div>
    {!populated.length ? <p className="business-empty-copy">No completed activity was recorded for this period.</p> : <>
      <div className="analytics-table-wrap activity-desktop-table"><table className="activity-table activity-performance-table"><thead><tr><th>Activity</th><th>{BUSINESS_COPY.metrics.revenue}</th><th>Sessions</th><th>Avg. value</th><th>Avg. duration</th><th>{BUSINESS_COPY.metrics.revenuePerHour}</th><th>Revenue vs previous</th></tr></thead><tbody>{populated.map((item) => <tr key={item.type}><th><span className={`activity-dot activity-dot--${item.type}`} />{item.label}</th><td>{formatCurrency(item.revenue)}</td><td>{item.sessions}</td><td>{item.averageSessionValue === null ? "—" : formatCurrency(item.averageSessionValue)}</td><td>{duration(item.averageSessionDurationMinutes)}</td><td>{item.revenuePerHour === null ? "—" : formatCurrency(item.revenuePerHour)}</td><td>{comparisonLabel(item.revenueComparison)}</td></tr>)}</tbody></table></div>
      <ActivityCards activities={populated} />
    </>}
  </section>;
}

export function StationPerformance({ query }) {
  if (query.loading) return <section className="analytics-panel"><AnalyticsLoading /></section>;
  if (query.error) return <section className="analytics-panel"><AnalyticsError onRetry={query.retry} /></section>;
  const stations = query.data?.stations ?? [];
  return <section className="analytics-panel station-performance" aria-labelledby="station-performance-title">
    <div className="analytics-panel__heading"><div><p className="eyebrow">Station performance · أداء المحطات</p><h3 id="station-performance-title">Performance by station · الأداء حسب المحطة</h3></div><p>Completed-session results use the station identity saved when each session ended.</p></div>
    {query.data?.dataQuality?.legacyFallbackSessions > 0 && <p className="station-data-note">{query.data.dataQuality.legacyFallbackSessions} legacy {query.data.dataQuality.legacyFallbackSessions === 1 ? "session uses" : "sessions use"} the current station identity because no completion snapshot was stored.</p>}
    {!stations.length ? <p className="business-empty-copy">No completed station sessions were recorded for this period.</p> : <>
      <div className="analytics-table-wrap activity-desktop-table"><table className="activity-table"><thead><tr><th>Station</th><th>{BUSINESS_COPY.metrics.revenue}</th><th>{BUSINESS_COPY.metrics.completedSessions}</th><th>Avg. session value</th><th>Avg. duration</th></tr></thead><tbody>{stations.map((item) => <tr key={item.key}><th><span className={`activity-dot activity-dot--${item.type}`} />{item.station}</th><td>{formatCurrency(item.revenue)}</td><td>{item.completedSessions}</td><td>{item.averageSessionValue === null ? "—" : formatCurrency(item.averageSessionValue)}</td><td>{duration(item.averageSessionDurationMinutes)}</td></tr>)}</tbody></table></div>
      <div className="activity-mobile-cards">{stations.map((item) => <article key={item.key}><h4><span className={`activity-dot activity-dot--${item.type}`} />{item.station}</h4><dl><div><dt>{BUSINESS_COPY.metrics.revenue}</dt><dd>{formatCurrency(item.revenue)}</dd></div><div><dt>Sessions</dt><dd>{item.completedSessions}</dd></div><div><dt>Avg. value</dt><dd>{item.averageSessionValue === null ? "—" : formatCurrency(item.averageSessionValue)}</dd></div><div><dt>Avg. duration</dt><dd>{duration(item.averageSessionDurationMinutes)}</dd></div></dl></article>)}</div>
    </>}
  </section>;
}
