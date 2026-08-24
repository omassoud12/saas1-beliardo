import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { SessionPanel } from "./components/SessionPanel";
import { StationForm } from "./components/stations/StationForm";
import { createStation, getStationName, sortStations } from "./data/stationTypes";
import { useClock } from "./hooks/useClock";
import { usePersistentStations } from "./hooks/usePersistentStations";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { formatMoney, getCurrentCost, timeInputToTimestamp } from "./utils/session";

export default function App() {
  const [stations, setStations] = usePersistentStations();
  const [view, setView] = useState("home");
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [stationForm, setStationForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const noticeTimeoutRef = useRef(null);
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
  }, [updateSelectedStation]);

  const handleStart = useCallback(() => {
    const currentTime = Date.now();
    updateSelectedStation((station) => ({
      ...station,
      status: "active",
      sessionStartAt: station.plannedStartAt ?? currentTime,
      pausedAt: null,
      totalPausedMs: 0,
    }));
  }, [updateSelectedStation]);

  const handlePause = useCallback(() => {
    updateSelectedStation((station) => ({ ...station, status: "paused", pausedAt: Date.now() }));
  }, [updateSelectedStation]);

  const handleResume = useCallback(() => {
    const currentTime = Date.now();
    updateSelectedStation((station) => ({
      ...station,
      status: "active",
      totalPausedMs: station.totalPausedMs + Math.max(0, currentTime - station.pausedAt),
      pausedAt: null,
    }));
  }, [updateSelectedStation]);

  const handleEnd = useCallback(() => {
    const currentStation = stations.find((station) => station.id === selectedStationId);
    const finalCost = currentStation ? getCurrentCost(currentStation, Date.now()) : 0;
    updateSelectedStation((station) => ({
      ...station,
      status: "available",
      sessionStartAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      plannedStartAt: null,
    }));
    setSelectedStationId(null);
    showNotice(`${currentStation ? getStationName(currentStation) : "Station"} closed · Final total ${formatMoney(finalCost)}`);
  }, [selectedStationId, showNotice, stations, updateSelectedStation]);

  const handleViewChange = useCallback((nextView) => {
    setSelectedStationId(null);
    setView(nextView);
  }, []);

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />

      <main className="dashboard">
        <Header summary={summary} view={view} onViewChange={handleViewChange} />
        {view === "home" ? (
          <Home
            stations={stations}
            now={now}
            selectedStationId={selectedStationId}
            onSelect={setSelectedStationId}
            onManageStations={() => setView("dashboard")}
          />
        ) : (
          <Dashboard
            stations={stations}
            onAdd={() => setStationForm({ station: null })}
            onEdit={(station) => setStationForm({ station })}
            onDelete={handleDeleteStation}
          />
        )}
      </main>

      {selectedStation && (
        <SessionPanel
          station={selectedStation}
          now={now}
          onClose={handleClosePanel}
          onRateChange={(value) => {
            const rate = Math.min(999, Math.max(0, Number(value) || 0));
            updateSelectedStation((station) => ({ ...station, hourlyRate: rate }));
          }}
          onStartTimeChange={handleStartTimeChange}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onEnd={handleEnd}
        />
      )}

      {stationForm && (
        <StationForm
          station={stationForm.station}
          stations={stations}
          onClose={handleCloseForm}
          onSave={handleSaveStation}
        />
      )}

      {notice && (
        <div className="toast" role="status">
          <span aria-hidden="true">✓</span>
          {notice}
        </div>
      )}
    </div>
  );
}
