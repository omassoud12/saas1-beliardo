import { formatCurrency, formatDuration } from "../../utils/analytics";

function formatTime(value, timezone) {
  if (!value) return "In progress";
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function SessionTable({ sessions = [], timezone, pagination, onPageChange }) {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const shownFrom = pagination?.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const shownTo = pagination?.total ? shownFrom + safeSessions.length - 1 : 0;
  return (
    <section className="analytics-panel session-list" aria-labelledby="completed-activity-title">
      <div className="analytics-panel__heading">
        <div><p className="eyebrow">Session ledger</p><h3 id="completed-activity-title">Activity details</h3></div>
        <p>{pagination ? `Showing ${shownFrom}–${shownTo} of ${pagination.total} sessions.` : `${safeSessions.length} session${safeSessions.length === 1 ? "" : "s"} shown for this day.`}</p>
      </div>
      {safeSessions.length === 0 ? (
        <div className="analytics-empty analytics-empty--compact"><p>No sessions were recorded for this day.</p></div>
      ) : (
        <div className="analytics-table-wrap">
          <table className="session-table">
            <thead><tr><th scope="col">Time</th><th scope="col">Activity</th><th scope="col">Duration</th><th scope="col">Revenue</th><th scope="col">Status</th></tr></thead>
            <tbody>{safeSessions.map((session) => (
              <tr key={session.id}>
                <td data-label="Time"><strong>{formatTime(session.startedAt, timezone)}</strong><span>&rarr; {formatTime(session.endedAt, timezone)}</span></td>
                <td data-label="Activity"><span className={`activity-dot activity-dot--${session.activity}`} />{session.activityLabel}<small>Station {session.stationNumber}</small></td>
                <td data-label="Duration">{session.status === "completed" ? formatDuration(session.durationSeconds) : "Running"}</td>
                <td data-label="Revenue">{session.status === "completed" ? formatCurrency(session.revenue) : "—"}</td>
                <td data-label="Status"><span className={`analytics-status analytics-status--${session.status}`}>{session.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {pagination && pagination.total > pagination.pageSize && <div className="record-pagination"><button className="button button--secondary" type="button" disabled={pagination.page <= 1} onClick={() => onPageChange?.(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}</span><button className="button button--secondary" type="button" disabled={!pagination.hasMore} onClick={() => onPageChange?.(pagination.page + 1)}>Next</button></div>}
    </section>
  );
}
