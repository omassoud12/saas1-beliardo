import { useEffect, useState } from "react";
import { STATION_TYPES } from "../data/stationTypes";
import { fetchTodayActivities } from "../lib/api";
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
  const [open, setOpen] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState({
    loading: false,
    error: "",
    activities: [],
    businessDate: currentBusinessDate,
  });

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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
