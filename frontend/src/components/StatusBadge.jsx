const labels = {
  available: "Available",
  active: "Active",
  paused: "Paused",
};

export function StatusBadge({ status, compact = false }) {
  return (
    <span className={`status-badge status-badge--${status}${compact ? " status-badge--compact" : ""}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
