import { useState } from "react";
import { STATION_TYPE_ORDER, STATION_TYPES, getStationName } from "../../data/stationTypes";
import { formatMoney } from "../../utils/session";
import { StatusBadge } from "../StatusBadge";

export function StationManager({ stations, onEdit, onDelete }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  return (
    <div className="station-manager">
      {STATION_TYPE_ORDER.map((type) => {
        const typeStations = stations.filter((station) => station.type === type);
        if (typeStations.length === 0) return null;

        return (
          <section className="manager-group" key={type}>
            <header className="manager-group__header">
              <h3>{STATION_TYPES[type].label}</h3>
              <span>{typeStations.length}</span>
            </header>
            <div className="manager-list">
              {typeStations.map((station) => (
                <article className={`manager-row manager-row--${station.type}`} key={station.id}>
                  <div className="manager-row__identity">
                    <span className="manager-row__mark" aria-hidden="true" />
                    <div>
                      <strong>{getStationName(station)}</strong>
                      <StatusBadge status={station.status} compact />
                    </div>
                  </div>
                  <div className="manager-row__rate">
                    <span>Hourly rate</span>
                    <strong>{formatMoney(station.hourlyRate)} <small>/ hr</small></strong>
                  </div>
                  {confirmDeleteId === station.id ? (
                    <div className="manager-row__confirm" role="group" aria-label={`Confirm delete ${getStationName(station)}`}>
                      <p>Remove {getStationName(station)}?</p>
                      <button type="button" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                      <button type="button" onClick={() => { onDelete(station.id); setConfirmDeleteId(null); }}>Delete</button>
                    </div>
                  ) : (
                    <div className="manager-row__actions">
                      <button type="button" onClick={() => onEdit(station)}>Edit</button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(station.id)}
                        disabled={["active", "paused"].includes(station.status)}
                        title={["active", "paused"].includes(station.status) ? "End or cancel the live session first" : undefined}
                      >Delete</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
