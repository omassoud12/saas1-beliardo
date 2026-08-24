import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { SessionTimer } from "./SessionTimer";
import { CloseIcon, PauseIcon, PlayIcon, StopIcon } from "./icons";
import { STATION_TYPES } from "../data/stationTypes";
import {
  formatMoney,
  formatTimeInput,
  getCurrentCost,
  getElapsedSeconds,
} from "../utils/session";

export function SessionPanel({
  station,
  now,
  onClose,
  onRateChange,
  onStartTimeChange,
  onStart,
  onPause,
  onResume,
  onEnd,
}) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const isAvailable = station.status === "available";
  const elapsed = getElapsedSeconds(station, now);
  const cost = getCurrentCost(station, now);
  const effectiveStartAt = station.sessionStartAt ?? station.plannedStartAt ?? now;
  const stationType = STATION_TYPES[station.type];

  const startLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(effectiveStartAt);
  }, [effectiveStartAt]);

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

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
      );
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

  useEffect(() => {
    setConfirmingEnd(false);
  }, [station.id, station.status]);

  return (
    <div className="session-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className={`session-panel session-panel--${station.type}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-title"
      >
        <div className="session-panel__accent" aria-hidden="true" />
        <header className="session-panel__header">
          <div>
            <p className="eyebrow">Session control</p>
            <div className="session-panel__identity">
              <h2 id="session-title">
                <span>{stationType.sessionLabel}</span> {String(station.number).padStart(2, "0")}
              </h2>
              <StatusBadge status={station.status} />
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="Close session controls"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="session-readout">
          <div className="session-readout__time">
            <span className="readout-label">{isAvailable ? "Session time" : "Elapsed time"}</span>
            <SessionTimer seconds={elapsed} />
            <small>{isAvailable ? "Ready when you are" : `Started ${startLabel}`}</small>
          </div>
          <div className="session-readout__cost">
            <span className="readout-label">Current cost</span>
            <strong>{formatMoney(cost)}</strong>
            <small>at {formatMoney(station.hourlyRate)} / hour</small>
          </div>
        </div>

        <div className="session-fields">
          <label className="field">
            <span>Price / hour</span>
            <span className="field__control field__control--money">
              <i aria-hidden="true">$</i>
              <input
                type="number"
                min="0"
                max="999"
                step="0.5"
                inputMode="decimal"
                value={station.hourlyRate}
                onChange={(event) => onRateChange(event.target.value)}
                aria-describedby="rate-hint"
              />
            </span>
            <small id="rate-hint">Updates the live total</small>
          </label>

          <label className="field">
            <span>Start time</span>
            <span className="field__control">
              <input
                type="time"
                value={formatTimeInput(effectiveStartAt)}
                onChange={(event) => onStartTimeChange(event.target.value)}
              />
            </span>
            <small>{isAvailable ? "Set before starting" : "Adjusts elapsed time"}</small>
          </label>
        </div>

        <footer className="session-actions">
          {isAvailable ? (
            <button className="button button--primary button--wide" type="button" onClick={onStart}>
              <PlayIcon />
              Start session
            </button>
          ) : (
            <>
              {station.status === "active" ? (
                <button className="button button--secondary" type="button" onClick={onPause}>
                  <PauseIcon />
                  Pause
                </button>
              ) : (
                <button className="button button--primary" type="button" onClick={onResume}>
                  <PlayIcon />
                  Resume
                </button>
              )}

              {confirmingEnd ? (
                <div className="end-confirmation" role="group" aria-label="Confirm end session">
                  <span>End at {formatMoney(cost)}?</span>
                  <button type="button" onClick={() => setConfirmingEnd(false)}>Keep open</button>
                  <button type="button" onClick={onEnd}>End now</button>
                </div>
              ) : (
                <button className="button button--danger" type="button" onClick={() => setConfirmingEnd(true)}>
                  <StopIcon />
                  End session
                </button>
              )}
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
