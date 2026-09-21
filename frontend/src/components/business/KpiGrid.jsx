export function KpiGrid({ items, eyebrow, title }) {
  return (
    <section className="business-kpi-section" aria-label={title || "Key performance indicators"}>
      {title && <div className="business-section-heading"><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div>}
      <div className={`business-kpi-grid business-kpi-grid--${items.length}`}>
        {items.map((item) => (
          <article className={`business-kpi ${item.emphasis ? "business-kpi--primary" : ""}`} key={item.key ?? item.label}>
            <div className="business-kpi__topline">
              <span className="business-kpi__icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            <strong>{item.value}</strong>
            {item.comparison && <p className={`business-kpi__comparison business-kpi__comparison--${item.comparison.tone}`}>{item.comparison.label}</p>}
            {item.description && <p className="business-kpi__description">{item.description}</p>}
          </article>
        ))}
      </div>
      {items.length > 2 && <span className="business-kpi-scroll-hint" aria-hidden="true">Swipe to view all metrics →</span>}
    </section>
  );
}
