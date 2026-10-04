import { useEffect, useState } from "react";
import { STATION_TYPES } from "../data/stationTypes";
import { editCompletedSession, fetchTodayActivities } from "../lib/api";
import { formatDuration, formatMoney } from "../utils/session";
import { ChevronDownIcon } from "./icons";

function formatStartTime(value, timezone) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ActivityDetails({ currentBusinessDate, refreshKey, timezone = "UTC" }) {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  function beginEdit(activity) {
    const seconds = Number(activity.finalElapsedSeconds) || 0;
    setEditing({ id: activity.id, expectedUpdatedAt: activity.updatedAt,
      hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60,
      cost: Number(activity.finalCost).toFixed(2) });
    setEditError("");
  }
  async function saveEdit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setEditError("");
    try {
      const session = await editCompletedSession(editing.id, {
        durationSeconds: Number(editing.hours) * 3600 + Number(editing.minutes) * 60 + Number(editing.seconds),
        finalCost: Number(editing.cost), expectedUpdatedAt: editing.expectedUpdatedAt,
      });
      setState(current => ({ ...current, activities: current.activities.map(activity => activity.id === session.id
        ? { ...activity, finalElapsedSeconds: session.finalElapsedSeconds, finalCost: session.finalCost, updatedAt: session.updatedAt } : activity) }));
      setEditing(null);
    } catch (error) { setEditError(error.message || "Unable to save session"); }
    finally { setSaving(false); }
  }
  const [open, setOpen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState({
    loading: false,
    error: "",
    activities: [],
    businessDate: currentBusinessDate,
  });

  const completedRevenue = state.activities.reduce(
    (total, activity) => total + (Number(activity.finalCost) || 0),
    0,
  );
  const completedHours = state.activities.reduce(
    (total, activity) => total + (Number(activity.finalElapsedSeconds) || 0),
    0,
  ) / 3600;

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: "" }));

    fetchTodayActivities()
      .then((result) => {
        if (!cancelled) setState({ loading: false, error: "", ...result });
      })
      .catch((error) => {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error.message || "Unable to load activity details",
          }));
        }
      });

    return () => { cancelled = true; };
  }, [open, refreshKey, retryKey]);

  return (
    <section className={`activity-details${open ? " activity-details--open" : ""}`} aria-labelledby="activity-details-title">
      <header className="activity-details__header">
        <div>
          <p className="eyebrow">Business day</p>
          <h2 id="activity-details-title">Activity Details</h2>
          <p>{state.businessDate ?? currentBusinessDate} / 6:00 AM to 6:00 AM</p>
        </div>
        <button
          className="activity-details__toggle"
          type="button"
          aria-expanded={open}
          aria-controls="activity-details-content"
          onClick={() => setOpen((current) => !current)}
        >
          <span>{open ? "Hide Activity Details" : "Show Activity Details"}</span>
          <ChevronDownIcon />
        </button>
      </header>

      <div
        className="activity-details__content"
        id="activity-details-content"
        aria-hidden={!open}
      >
        <div className="activity-details__content-inner">
          <dl className="activity-details__summary" aria-label="Completed activity summary">
            <div className="activity-details__summary-item activity-details__summary-item--revenue">
              <dt>Revenue</dt>
              <dd className="activity-details__summary-value">{formatMoney(completedRevenue)}</dd>
              <dd className="activity-details__summary-description">Completed-session revenue</dd>
            </div>
            <div className="activity-details__summary-item">
              <dt>Total Hours</dt>
              <dd className="activity-details__summary-value">{completedHours.toFixed(2)} hrs</dd>
              <dd className="activity-details__summary-description">Stored completed-session duration</dd>
            </div>
          </dl>
          {state.loading ? (
            <div className="activity-details__state" role="status">
              <span className="activity-details__loader" aria-hidden="true" />
              Loading activity details...
            </div>
          ) : state.error ? (
            <div className="activity-details__state activity-details__state--error" role="alert">
              <span>{state.error}</span>
              <button type="button" tabIndex={open ? 0 : -1} onClick={() => setRetryKey((current) => current + 1)}>Try again</button>
            </div>
          ) : state.activities.length === 0 ? (
            <div className="activity-details__empty">
              <strong>No completed activities</strong>
              <span>There are no finished sessions in the current business day.</span>
            </div>
          ) : (
            <div className="activity-list" role="table" aria-label="Current business day activities">
              <div className="activity-list__head" role="row">
                <span role="columnheader">Session Type</span>
                <span role="columnheader">Station</span>
                <span role="columnheader">Started</span>
                <span role="columnheader">Hours</span>
                <span role="columnheader">Cost</span>
                <span role="columnheader">Actions</span>
              </div>
              {state.activities.map((activity) => (
                <div className="activity-list__row" role="row" key={activity.id}>
                  <span className="activity-list__type" role="cell">
                    <i className={`activity-list__marker activity-list__marker--${activity.type}`} aria-hidden="true" />
                    {STATION_TYPES[activity.type]?.label ?? "Session"}
                  </span>
                  <span className="activity-list__station" role="cell" data-label="Station">
                    {activity.stationNumber == null ? "--" : String(activity.stationNumber).padStart(2, "0")}
                  </span>
                  <span className="activity-list__started" role="cell" data-label="Started">{formatStartTime(activity.startedAt, timezone)}</span>
                  <span className="activity-list__duration" role="cell" data-label="Hours">{formatDuration(activity.finalElapsedSeconds)}</span>
                  <span className="activity-list__cost" role="cell" data-label="Cost">{formatMoney(activity.finalCost)}</span>
                  <span className="activity-list__actions" role="cell"><button type="button" className="button button--secondary" tabIndex={open ? 0 : -1} disabled={saving} onClick={() => beginEdit(activity)} aria-label={`Edit ${STATION_TYPES[activity.type]?.label ?? "session"} station ${activity.stationNumber}`}>Edit</button></span>
                </div>
              ))}
            </div>
          )}
          {editing && open && <form className="activity-edit" onSubmit={saveEdit} aria-label="Edit completed session">
            <strong>Edit session</strong>
            <p>Correct the billed duration and cost. Original start and end times are retained.</p>
            <div className="activity-edit__fields">
              {[['hours', 'Hours', 8760], ['minutes', 'Minutes', 59], ['seconds', 'Seconds', 59], ['cost', 'Cost (USD)', 9999999999.99]].map(([key, label, max]) => <label key={key}>{label}<input type="number" required min="0" max={max} step={key === 'cost' ? '0.01' : '1'} value={editing[key]} disabled={saving} onChange={event => setEditing(current => ({ ...current, [key]: event.target.value }))} /></label>)}
            </div>
            {editError && <p role="alert">{editError}</p>}
            <div className="activity-edit__buttons"><button className="button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button><button className="button button--secondary" type="button" disabled={saving} onClick={() => setEditing(null)}>Cancel</button></div>
          </form>}
        </div>
      </div>
    </section>
  );
}
