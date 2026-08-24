import { StatusBadge } from "../StatusBadge";
import { STATION_TYPES, getStationName } from "../../data/stationTypes";
import { formatDuration, formatMoney, getCurrentCost, getElapsedSeconds } from "../../utils/session";

function BilliardMotif() {
  return (
    <span className="table-card__rail" aria-hidden="true">
      <i className="pocket pocket--tl" />
      <i className="pocket pocket--tm" />
      <i className="pocket pocket--tr" />
      <i className="pocket pocket--bl" />
      <i className="pocket pocket--bm" />
      <i className="pocket pocket--br" />
    </span>
  );
}

function PingPongMotif() {
  return (
    <span className="pingpong-motif" aria-hidden="true">
      <i className="pingpong-motif__net" />
      <i className="pingpong-motif__ball" />
    </span>
  );
}

function PlayStationMotif() {
  return (
    <svg className="controller-motif" viewBox="0 0 80 44" aria-hidden="true">
      <path d="M22 9h36c7 0 12 5 14 12l4 13c1.5 5-4 8-8 5l-10-8H22l-10 8c-4 3-9.5 0-8-5l4-13c2-7 7-12 14-12Z" />
      <path d="M22 18v10M17 23h10" />
      <circle cx="58" cy="19" r="2" />
      <circle cx="64" cy="25" r="2" />
    </svg>
  );
}

export function StationCard({ station, now, selected, onSelect }) {
  const type = STATION_TYPES[station.type];
  const isAvailable = station.status === "available";
  const elapsed = getElapsedSeconds(station, now);
  const cost = getCurrentCost(station, now);

  return (
    <button
      className={`table-card station-card station-card--${station.type} table-card--${station.status}${selected ? " table-card--selected" : ""}`}
      type="button"
      onClick={() => onSelect(station.id)}
      aria-label={`${getStationName(station)}, ${station.status}${isAvailable ? "" : `, ${formatDuration(elapsed)}, ${formatMoney(cost)}`}. Open controls`}
      aria-pressed={selected}
    >
      {station.type === "billiard" && <BilliardMotif />}
      {station.type === "pingpong" && <PingPongMotif />}

      <span className="table-card__surface">
        {station.type === "playstation" && <PlayStationMotif />}
        <span className="table-card__topline">
          <span className="table-card__number">
            <small>{type.cardLabel}</small>
            {String(station.number).padStart(2, "0")}
          </span>
          <StatusBadge status={station.status} compact />
        </span>

        {isAvailable ? (
          <span className="table-card__available-copy">
            <strong>Ready for play</strong>
            <span>Open station <span aria-hidden="true">→</span></span>
          </span>
        ) : (
          <span className="table-card__live-values">
            <span className="table-card__timer">{formatDuration(elapsed)}</span>
            <span className="table-card__cost">{formatMoney(cost)}</span>
          </span>
        )}
      </span>
    </button>
  );
}
