import { StationManager } from "../components/stations/StationManager";

export function Dashboard({ stations, onAdd, onEdit, onDelete }) {
  return (
    <section className="configuration-page">
      <div className="configuration-page__heading">
        <div>
          <p className="eyebrow">Configuration</p>
          <h2>Station management</h2>
          <p>Set up the equipment available on your live floor.</p>
        </div>
        <button className="button button--primary add-station-button" type="button" onClick={onAdd}>
          <span aria-hidden="true">+</span>
          Add station
        </button>
      </div>

      {stations.length === 0 ? (
        <div className="empty-state empty-state--dashboard">
          <div className="empty-state__symbol" aria-hidden="true"><span /></div>
          <h3>Your station list is empty</h3>
          <p>Add equipment once, then manage its sessions from Home.</p>
          <button className="button button--primary" type="button" onClick={onAdd}>Add first station</button>
        </div>
      ) : (
        <StationManager stations={stations} onEdit={onEdit} onDelete={onDelete} />
      )}
    </section>
  );
}
