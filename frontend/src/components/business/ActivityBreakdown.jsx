import { formatCurrency, formatHours } from "../../utils/analytics";

export function ActivityBreakdown({ activities, total }) {
  return (
    <section className="analytics-panel activity-panel" aria-labelledby="activity-performance-title">
      <div className="analytics-panel__heading">
        <div>
          <p className="eyebrow">Performance mix</p>
          <h3 id="activity-performance-title">Activity breakdown</h3>
        </div>
        <p>Completed sessions, usage and revenue by activity.</p>
      </div>
      <div className="analytics-table-wrap">
        <table className="activity-table">
          <thead><tr><th scope="col">Activity</th><th scope="col">Sessions</th><th scope="col">Hours</th><th scope="col">Revenue</th></tr></thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.type}>
                <th scope="row"><span className={`activity-dot activity-dot--${activity.type}`} />{activity.label}</th>
                <td>{activity.sessions}</td><td>{formatHours(activity.hours)}</td><td>{formatCurrency(activity.revenue)}</td>
              </tr>
            ))}
          </tbody>
          {total && <tfoot><tr><th scope="row">All Activities</th><td>{total.sessions}</td><td>{formatHours(total.hours)}</td><td>{formatCurrency(total.revenue)}</td></tr></tfoot>}
        </table>
      </div>
    </section>
  );
}
