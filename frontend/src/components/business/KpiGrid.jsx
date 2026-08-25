export function KpiGrid({ items }) {
  return (
    <section className={`business-kpi-grid business-kpi-grid--${items.length}`} aria-label="Key performance indicators">
      {items.map((item) => (
        <article className={`business-kpi ${item.emphasis ? "business-kpi--primary" : ""}`} key={item.label}>
          <div className="business-kpi__topline">
            <span className="business-kpi__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </div>
          <strong>{item.value}</strong>
          <p>{item.description}</p>
        </article>
      ))}
    </section>
  );
}
