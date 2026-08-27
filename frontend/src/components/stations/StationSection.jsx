import { STATION_TYPES } from "../../data/stationTypes";
import { StationCard } from "./StationCard";

export function StationSection({ type, stations, selectedStationId, onSelect }) {
  const metadata = STATION_TYPES[type];
  const countLabel = stations.length === 1
    ? metadata.countLabel.replace(/s$/, "")
    : metadata.countLabel;

  return (
    <section className={`station-section station-section--${type}`} aria-labelledby={`${type}-heading`}>
      <div className="station-section__heading">
        <div>
          <span className="station-section__marker" aria-hidden="true" />
          <h2 id={`${type}-heading`}>{metadata.label}</h2>
        </div>
        <p>{stations.length} {countLabel}</p>
      </div>
      <div className="table-grid station-grid">
        {stations.map((station) => (
          <StationCard
            key={station.id}
            station={station}
            selected={station.id === selectedStationId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
