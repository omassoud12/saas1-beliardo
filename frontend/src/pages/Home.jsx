import { STATION_TYPE_ORDER } from "../data/stationTypes";
import { StationSection } from "../components/stations/StationSection";

export function Home({ stations, now, selectedStationId, onSelect, onManageStations }) {
  if (stations.length === 0) {
    return (
      <section className="empty-state empty-state--home">
        <div className="empty-state__symbol" aria-hidden="true"><span /></div>
        <p className="eyebrow">Live floor</p>
        <h2>No stations configured yet</h2>
        <p>{onManageStations ? "Add your first Billiard, Ping Pong, or PlayStation station from the Dashboard." : "Ask the lounge owner to configure stations."}</p>
        {onManageStations && <button className="button button--primary" type="button" onClick={onManageStations}>Configure stations</button>}
      </section>
    );
  }

  return (
    <div className="live-floor">
      <div className="section-heading section-heading--floor">
        <div>
          <p className="eyebrow">Live floor</p>
          <h2>Station overview</h2>
        </div>
        <p>Select any station to manage its session.</p>
      </div>

      {STATION_TYPE_ORDER.map((type) => {
        const typeStations = stations.filter((station) => station.type === type);
        if (typeStations.length === 0) return null;
        return (
          <StationSection
            key={type}
            type={type}
            stations={typeStations}
            now={now}
            selectedStationId={selectedStationId}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
