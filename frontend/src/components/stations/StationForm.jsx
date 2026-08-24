import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "../icons";
import { STATION_TYPE_ORDER, STATION_TYPES } from "../../data/stationTypes";

export function StationForm({ station, stations, onClose, onSave }) {
  const [type, setType] = useState(station?.type ?? "billiard");
  const [number, setNumber] = useState(station?.number ?? "");
  const [hourlyRate, setHourlyRate] = useState(station?.hourlyRate ?? "");
  const [error, setError] = useState("");
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const isEditing = Boolean(station);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll("button:not([disabled]), input:not([disabled])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const parsedNumber = Number(number);
    const parsedRate = Number(hourlyRate);

    if (!Number.isInteger(parsedNumber) || parsedNumber < 1 || parsedNumber > 999) {
      setError("Enter a station number between 1 and 999.");
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate <= 0 || parsedRate > 999) {
      setError("Enter an hourly rate greater than $0 and below $1,000.");
      return;
    }

    const duplicate = stations.some((item) => (
      item.id !== station?.id && item.type === type && item.number === parsedNumber
    ));
    if (duplicate) {
      setError(`${STATION_TYPES[type].label} ${String(parsedNumber).padStart(2, "0")} already exists.`);
      return;
    }

    onSave({ type, number: parsedNumber, hourlyRate: parsedRate });
  };

  return (
    <div className="session-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="station-form-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-form-title"
      >
        <header className="station-form-dialog__header">
          <div>
            <p className="eyebrow">Station configuration</p>
            <h2 id="station-form-title">{isEditing ? "Edit station" : "Add station"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} ref={closeButtonRef} aria-label="Close station form">
            <CloseIcon />
          </button>
        </header>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset className="type-selector">
            <legend>Station type</legend>
            <div>
              {STATION_TYPE_ORDER.map((option) => (
                <button
                  key={option}
                  className={`type-option type-option--${option}${type === option ? " type-option--selected" : ""}`}
                  type="button"
                  aria-pressed={type === option}
                  onClick={() => { setType(option); setError(""); }}
                >
                  <span className="type-option__mark" aria-hidden="true" />
                  {STATION_TYPES[option].label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="station-form-dialog__fields">
            <label className="field">
              <span>Number</span>
              <span className="field__control">
                <input
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  inputMode="numeric"
                  value={number}
                  onChange={(event) => { setNumber(event.target.value); setError(""); }}
                  placeholder="01"
                  autoFocus
                />
              </span>
              <small>Unique within this station type</small>
            </label>

            <label className="field">
              <span>Fixed hourly cost</span>
              <span className="field__control field__control--money">
                <i aria-hidden="true">$</i>
                <input
                  type="number"
                  min="0.01"
                  max="999"
                  step="0.5"
                  inputMode="decimal"
                  value={hourlyRate}
                  onChange={(event) => { setHourlyRate(event.target.value); setError(""); }}
                  placeholder="6.00"
                />
              </span>
              <small>Used automatically for new sessions</small>
            </label>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <footer className="station-form-dialog__actions">
            <button className="button button--secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit">
              {isEditing ? "Save changes" : "Add station"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
