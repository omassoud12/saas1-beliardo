import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { SessionTimer } from "./SessionTimer";
import { CloseIcon, PlayIcon, StopIcon } from "./icons";
import { STATION_TYPES } from "../data/stationTypes";
import { useClock } from "../hooks/useClock";
import {
  formatZonedTimeInput,
  formatMoney,
  formatTimeInput,
  getCurrentCost,
  getElapsedSeconds,
  getAdjustedSessionPreview,
  zonedTimeToTimestamp,
} from "../utils/session";

export function SessionPanel({
  station,
  onClose,
  onRateChange,
  onStartTimeChange,
  onStart,
  onResume,
  onEnd,
  onCancel,
  timezone = "UTC",
  busy = false,
}) {
  const now = useClock();
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const safeActionRef = useRef(null);
  const [confirmationMode, setConfirmationMode] = useState(null);
  const [endTimeInput, setEndTimeInput] = useState("");
  const [endTimeAdjusted, setEndTimeAdjusted] = useState(false);
  const confirmationModeRef = useRef(null);
  const isAvailable = station.status === "available";
  const elapsed = getElapsedSeconds(station, now);
  const cost = getCurrentCost(station, now);
  const effectiveStartAt = station.sessionStartAt ?? station.plannedStartAt ?? now;
  const stationType = STATION_TYPES[station.type];
  const selectedEnd = endTimeAdjusted ? zonedTimeToTimestamp(endTimeInput, timezone, now) : now;
  const adjustedEndPreview = selectedEnd ? getAdjustedSessionPreview(station, selectedEnd) : null;
  const endTimeError = confirmationMode !== "end" ? null
    : !selectedEnd ? "Enter a valid lounge date and time."
      : selectedEnd < station.sessionStartAt ? "End time cannot be before the session start."
        : selectedEnd > now + 1_000 ? "End time cannot be in the future."
          : endTimeAdjusted && adjustedEndPreview?.hasUntrackedPause
            ? "This older session has no detailed pause history, so its end time cannot be adjusted."
            : null;

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
        if (confirmationModeRef.current) setConfirmationMode(null);
        else onClose();
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
    setConfirmationMode(null);
  }, [station.id, station.status]);

  useEffect(() => {
    confirmationModeRef.current = confirmationMode;
    if (confirmationMode) safeActionRef.current?.focus();
  }, [confirmationMode]);

  const openEndConfirmation = () => {
    setEndTimeInput(formatZonedTimeInput(now, timezone));
    setEndTimeAdjusted(false);
    setConfirmationMode("end");
  };

  const confirmEnd = () => {
    if (endTimeError || !selectedEnd) return;
    onEnd(endTimeAdjusted ? new Date(selectedEnd).toISOString() : undefined);
  };

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
        aria-busy={busy}
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
                disabled={busy}
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
                disabled={busy}
              />
            </span>
            <small>{isAvailable ? "Set before starting" : "Adjusts elapsed time"}</small>
          </label>
        </div>

        <footer className={`session-actions${isAvailable ? "" : " session-actions--live"}`}>
          {isAvailable ? (
            <button className="button button--primary button--wide" type="button" onClick={onStart} disabled={busy}>
              <PlayIcon />
              Start session
            </button>
          ) : (
            <>
              <div className="session-actions__primary">
                {station.status === "paused" && (
                  <button className="button button--primary" type="button" onClick={onResume} disabled={busy}>
                    <PlayIcon />
                    Resume
                  </button>
                )}

                {confirmationMode === "end" ? (
                  <div className="end-confirmation" role="alertdialog" aria-label="Confirm end session">
                    <label className="end-time-field">
                      <span>End time · {timezone}</span>
                      <input
                        type="time"
                        value={endTimeInput}
                        onChange={(event) => { setEndTimeInput(event.target.value); setEndTimeAdjusted(true); }}
                        disabled={busy}
                        aria-invalid={Boolean(endTimeError)}
                        aria-describedby={endTimeError ? "end-time-error" : undefined}
                      />
                    </label>
                    {endTimeError && <p className="end-time-error" id="end-time-error">{endTimeError}</p>}
                    <div className="end-confirmation__actions">
                      <button ref={safeActionRef} type="button" onClick={() => setConfirmationMode(null)} disabled={busy}>Keep session</button>
                      <button type="button" onClick={confirmEnd} disabled={busy || Boolean(endTimeError)}>{busy ? "Ending…" : "Confirm end"}</button>
                    </div>
                  </div>
                ) : (
                  <button className="button button--danger" type="button" onClick={openEndConfirmation} disabled={busy || confirmationMode === "cancel"}>
                    <StopIcon />
                    End session
                  </button>
                )}
              </div>

              <div className="cancel-session-area">
                {confirmationMode === "cancel" ? (
                  <div className="cancel-confirmation" role="alertdialog" aria-labelledby="cancel-session-title" aria-describedby="cancel-session-description">
                    <div>
                      <strong id="cancel-session-title">Cancel this session?</strong>
                      <p id="cancel-session-description">This will reset the station and discard the session’s elapsed time and cost. It will not be included in completed sessions, revenue, or reports.</p>
                    </div>
                    <div className="cancel-confirmation__actions">
                      <button ref={safeActionRef} type="button" onClick={() => setConfirmationMode(null)} disabled={busy}>Keep session</button>
                      <button type="button" onClick={onCancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel session"}</button>
                    </div>
                  </div>
                ) : (
                  <button className="button button--cancel" type="button" onClick={() => setConfirmationMode("cancel")} disabled={busy || confirmationMode === "end"}>
                    Cancel session
                  </button>
                )}
              </div>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
