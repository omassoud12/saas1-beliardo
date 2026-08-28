export function BusinessNavbar({ section, onBack, onSectionChange, action }) {
  return (
    <nav className="business-nav" aria-label="Business analytics navigation">
      <button className="business-nav__back" type="button" onClick={onBack}>
        <span aria-hidden="true">&larr;</span> Dashboard
      </button>
      <div className="business-nav__main">
      <div className="business-nav__tabs" role="tablist" aria-label="Summary period">
        {["daily", "monthly", "yearly"].map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={section === item}
            className={section === item ? "is-active" : ""}
            onClick={() => onSectionChange(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {action}
      </div>
    </nav>
  );
}
