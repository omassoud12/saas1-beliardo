import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { AuthGate } from "./components/AuthGate";
import { SessionPanel } from "./components/SessionPanel";
import { StationForm } from "./components/stations/StationForm";
import { createStation, getStationName, sortStations } from "./data/stationTypes";
import { useClock } from "./hooks/useClock";
import { usePersistentStations } from "./hooks/usePersistentStations";
import {
  createSession, deleteSession, endSession, fetchActiveSessions, pauseSession,
  resumeSession, startSession, updateSession,
} from "./lib/api";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { BusinessAnalytics } from "./pages/business/BusinessAnalytics";
import { formatMoney, timeInputToTimestamp } from "./utils/session";

export default function App() {
  return <AuthGate>{({ signOut }) => <AuthenticatedApp onSignOut={signOut} />}</AuthGate>;
}

function AuthenticatedApp({ onSignOut }) {
  const [stations, setStations, stationsHydrated] = usePersistentStations();
  const [view, setView] = useState("home");
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [stationForm, setStationForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sessionIds, setSessionIds] = useState({});
  const [sessionActionPending, setSessionActionPending] = useState(false);
  const noticeTimeoutRef = useRef(null);
  const sessionsHydratedRef = useRef(false);
  const now = useClock();

  const selectedStation = stations.find((station) => station.id === selectedStationId) ?? null;
  const handleClosePanel = useCallback(() => setSelectedStationId(null), []);
  const handleCloseForm = useCallback(() => setStationForm(null), []);

  const summary = useMemo(() => ({
    total: stations.length,
    active: stations.filter((station) => station.status === "active").length,
    paused: stations.filter((station) => station.status === "paused").length,
    available: stations.filter((station) => station.status === "available").length,
  }), [stations]);

  const updateSelectedStation = useCallback((updater) => {
    setStations((currentStations) => sortStations(currentStations.map((station) => (
      station.id === selectedStationId ? updater(station) : station
    ))));
  }, [selectedStationId, setStations]);

  const showNotice = useCallback((message) => {
    window.clearTimeout(noticeTimeoutRef.current);
    setNotice(message);
    noticeTimeoutRef.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  useEffect(() => () => window.clearTimeout(noticeTimeoutRef.current), []);

  useEffect(() => {
    if (!stationsHydrated || sessionsHydratedRef.current) return;
    sessionsHydratedRef.current = true;
    fetchActiveSessions().then((sessions) => {
      const ids = {};
      for (const session of sessions) ids[session.stationId] = session.id;
      setSessionIds(ids);
      setStations((currentStations) => currentStations.map((station) => {
        const session = sessions.find((item) => item.stationId === station.id);
        return session ? stationFromSession(station, session) : station;
      }));
    }).catch(() => {
      // Station configuration can still load from local storage while signed out.
    });
  }, [setStations, stationsHydrated]);

  const handleSaveStation = useCallback((values) => {
    if (stationForm?.station) {
      const stationName = getStationName({ ...stationForm.station, ...values });
      setStations((currentStations) => sortStations(currentStations.map((station) => (
        station.id === stationForm.station.id ? { ...station, ...values } : station
      ))));
      showNotice(`${stationName} updated`);
    } else {
      const station = createStation(values);
      setStations((currentStations) => sortStations([...currentStations, station]));
      showNotice(`${getStationName(station)} added and ready on Home`);
    }
    setStationForm(null);
  }, [setStations, showNotice, stationForm]);

  const handleDeleteStation = useCallback((stationId) => {
    const station = stations.find((item) => item.id === stationId);
    setStations((currentStations) => currentStations.filter((item) => item.id !== stationId));
    if (selectedStationId === stationId) setSelectedStationId(null);
    showNotice(`${station ? getStationName(station) : "Station"} deleted`);
  }, [selectedStationId, setStations, showNotice, stations]);

  const handleStartTimeChange = useCallback((value) => {
    const timestamp = timeInputToTimestamp(value, Date.now());
    if (!timestamp) return;
    updateSelectedStation((station) => station.status === "available"
      ? { ...station, plannedStartAt: timestamp }
      : { ...station, sessionStartAt: timestamp });
    const sessionId = sessionIds[selectedStationId];
    if (sessionId) {
      updateSession(sessionId, { startTime: new Date(timestamp).toISOString() })
        .catch(() => showNotice("Unable to update the live start time"));
    }
  }, [selectedStationId, sessionIds, showNotice, updateSelectedStation]);

  const handleStart = useCallback(async () => {
    const station = stations.find((item) => item.id === selectedStationId);
    if (!station || sessionActionPending) return;
    setSessionActionPending(true);
    let draft;
    try {
      draft = await createSession(station.id, station.hourlyRate);
      const startTime = new Date(station.plannedStartAt ?? Date.now()).toISOString();
      const session = await startSession(draft.id, startTime);
      setSessionIds((current) => ({ ...current, [station.id]: session.id }));
      updateSelectedStation((current) => stationFromSession(current, session));
      showNotice(`${getStationName(station)} session started`);
    } catch (error) {
      if (draft?.id) deleteSession(draft.id).catch(() => {});
      showNotice(error.message || "Unable to start session");
    } finally {
      setSessionActionPending(false);
    }
  }, [selectedStationId, sessionActionPending, showNotice, stations, updateSelectedStation]);

  const handlePause = useCallback(async () => {
    const sessionId = sessionIds[selectedStationId];
    if (!sessionId || sessionActionPending) {
      showNotice("Live session record not found");
      return;
    }
    setSessionActionPending(true);
    try {
      const session = await pauseSession(sessionId);
      updateSelectedStation((station) => stationFromSession(station, session));
    } catch (error) {
      showNotice(error.message || "Unable to pause session");
    } finally {
      setSessionActionPending(false);
    }
  }, [selectedStationId, sessionActionPending, sessionIds, showNotice, updateSelectedStation]);

  const handleResume = useCallback(async () => {
    const sessionId = sessionIds[selectedStationId];
    if (!sessionId || sessionActionPending) {
      showNotice("Live session record not found");
      return;
    }
    setSessionActionPending(true);
    try {
      const session = await resumeSession(sessionId);
      updateSelectedStation((station) => stationFromSession(station, session));
    } catch (error) {
      showNotice(error.message || "Unable to resume session");
    } finally {
      setSessionActionPending(false);
    }
  }, [selectedStationId, sessionActionPending, sessionIds, showNotice, updateSelectedStation]);

  const handleEnd = useCallback(async () => {
    const currentStation = stations.find((station) => station.id === selectedStationId);
    const sessionId = sessionIds[selectedStationId];
    if (!currentStation || !sessionId || sessionActionPending) {
      showNotice("Live session record not found");
      return;
    }
    setSessionActionPending(true);
    try {
      const session = await endSession(sessionId);
      updateSelectedStation(resetStationSession);
      setSessionIds((current) => {
        const next = { ...current };
        delete next[currentStation.id];
        return next;
      });
      setSelectedStationId(null);
      showNotice(`${getStationName(currentStation)} closed · Final total ${formatMoney(session.finalCost)}`);
    } catch (error) {
      showNotice(error.message || "Unable to end session");
    } finally {
      setSessionActionPending(false);
    }
  }, [selectedStationId, sessionActionPending, sessionIds, showNotice, stations, updateSelectedStation]);

  const handleViewChange = useCallback((nextView) => {
    setSelectedStationId(null);
    setView(nextView);
  }, []);

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />

      <main className="dashboard">
        <Header summary={summary} view={view} onViewChange={handleViewChange} onSignOut={onSignOut} />
        {view === "home" ? (
          <Home
            stations={stations}
            now={now}
            selectedStationId={selectedStationId}
            onSelect={setSelectedStationId}
            onManageStations={() => setView("dashboard")}
          />
        ) : view === "dashboard" ? (
          <Dashboard
            stations={stations}
            onAdd={() => setStationForm({ station: null })}
            onEdit={(station) => setStationForm({ station })}
            onDelete={handleDeleteStation}
          />
        ) : <BusinessAnalytics onBack={() => handleViewChange("dashboard")} />}
      </main>

      {selectedStation && (
        <SessionPanel
          station={selectedStation}
          now={now}
          onClose={handleClosePanel}
          onRateChange={(value) => {
            const rate = Math.min(999, Math.max(0, Number(value) || 0));
            updateSelectedStation((station) => ({ ...station, hourlyRate: rate }));
            const sessionId = sessionIds[selectedStationId];
            if (sessionId) {
              updateSession(sessionId, { hourlyRate: rate })
                .catch(() => showNotice("Unable to update the live hourly rate"));
            }
          }}
          onStartTimeChange={handleStartTimeChange}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onEnd={handleEnd}
          busy={sessionActionPending}
        />
      )}

      {stationForm && (
        <StationForm station={stationForm.station} stations={stations} onClose={handleCloseForm} onSave={handleSaveStation} />
      )}

      {notice && <div className="toast" role="status"><span aria-hidden="true">✓</span>{notice}</div>}
    </div>
  );
}

function stationFromSession(station, session) {
  return {
    ...station,
    status: session.status,
    hourlyRate: session.hourlyRate,
    sessionStartAt: session.startedAt ? new Date(session.startedAt).getTime() : null,
    pausedAt: session.pausedAt ? new Date(session.pausedAt).getTime() : null,
    totalPausedMs: Number(session.totalPausedSeconds || 0) * 1000,
    plannedStartAt: null,
  };
}

function resetStationSession(station) {
  return { ...station, status: "available", sessionStartAt: null, pausedAt: null, totalPausedMs: 0, plannedStartAt: null };
}
