export function PeriodNavigator({ label, onPrevious, onNext, onCurrent, children, currentLabel }) {
  return (
    <div className="period-navigator" aria-label={`${label} navigation`}>
      <button type="button" onClick={onPrevious} aria-label={`Previous ${label}`}>&larr;</button>
      <div className="period-navigator__current">{children}</div>
      <button type="button" onClick={onNext} aria-label={`Next ${label}`}>&rarr;</button>
      <button className="period-navigator__today" type="button" onClick={onCurrent}>
        {currentLabel}
      </button>
    </div>
  );
}
