import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { AuthGate } from "./components/AuthGate";
import { AccountState } from "./components/AccountState";
import { PasswordSetup } from "./components/PasswordSetup";
import { createStation, getStationName, sortStations } from "./data/stationTypes";
import { usePersistentStations } from "./hooks/usePersistentStations";
import {
  cancelSession, endSession, fetchActiveSessions, pauseSession, resumeSession, startNewSession,
  updateSession, fetchMyAccess, acceptEmployeeInvitation, completePasswordSetup,
} from "./lib/api";
import { Home } from "./pages/Home";
import { formatMoney, timeInputToTimestamp } from "./utils/session";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Employees = lazy(() => import("./pages/Employees").then((module) => ({ default: module.Employees })));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin").then((module) => ({ default: module.PlatformAdmin })));
const SessionPanel = lazy(() => import("./components/SessionPanel").then((module) => ({ default: module.SessionPanel })));
const StationForm = lazy(() => import("./components/stations/StationForm").then((module) => ({ default: module.StationForm })));
const BusinessAnalytics = lazy(() => import("./pages/business/BusinessAnalytics").then((module) => ({ default: module.BusinessAnalytics })));

export default function App() {
  return <AuthGate>{({ session, signOut }) => <AccessRouter session={session} onSignOut={signOut} />}</AuthGate>;
}

function AccessRouter({ session, onSignOut }) {
  const passwordSetupKey = `password-setup.${session.user.id}`;
  const invitationAcceptanceRef = useRef({ token: null, promise: null });
  const [result, setResult] = useState({ loading: true, access: null, error: "", needsPassword: false, passwordReason: "invite" });
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("invite");
        let passwordReason = window.sessionStorage.getItem(passwordSetupKey) || "";
        if (token) {
          if (invitationAcceptanceRef.current.token !== token) {
            invitationAcceptanceRef.current = {
              token,
              promise: acceptEmployeeInvitation(token),
            };
          }
          await invitationAcceptanceRef.current.promise;
          passwordReason = "invite";
          window.sessionStorage.setItem(passwordSetupKey, passwordReason);
          params.delete("invite");
        }
        if (params.get("reset_password") === "1") {
          passwordReason = "reset";
          window.sessionStorage.setItem(passwordSetupKey, passwordReason);
          params.delete("reset_password");
        }
        window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
        const access = await fetchMyAccess();
        const requiresPassword = Boolean(passwordReason || access.profile.requiresPasswordSetup);
        if (mounted) setResult({ loading: false, access, error: "", needsPassword: requiresPassword, passwordReason: passwordReason || "invite" });
      } catch (error) {
        if (mounted) setResult({ loading: false, access: null, error: error.message, needsPassword: false, passwordReason: "invite" });
      }
    }
    load();
    return () => { mounted = false; };
  }, [passwordSetupKey, session.user.id]);

  if (result.loading) return <div className="auth-loading" aria-label="Loading account access"><span /></div>;
  if (result.needsPassword) return <PasswordSetup reason={result.passwordReason} onSignOut={onSignOut} onComplete={async () => { await completePasswordSetup(); const access = await fetchMyAccess(); window.sessionStorage.removeItem(passwordSetupKey); setResult((current) => ({ ...current, access, needsPassword: false })); }} />;
  if (!result.access) return <AccountState state="no_access" error={result.error} onSignOut={onSignOut} />;
  if (result.access.state === "platform_admin") return <Suspense fallback={<div className="auth-loading" aria-label="Loading platform administration"><span /></div>}><PlatformAdmin onSignOut={onSignOut} /></Suspense>;
  if (!["approved_owner", "active_employee"].includes(result.access.state)) return <AccountState state={result.access.state} onSignOut={onSignOut} />;
  return <AuthenticatedApp onSignOut={onSignOut} access={result.access} />;
}

function AuthenticatedApp({ onSignOut, access }) {
  const [stations, setStations, stationsHydrated] = usePersistentStations({ businessId: access.tenant.id, canManage: access.permissions.manageStations });
  const [view, setView] = useState("home");
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [stationForm, setStationForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sessionIds, setSessionIds] = useState({});
  const [finishedToday, setFinishedToday] = useState(null);
  const [businessDate, setBusinessDate] = useState(access.tenant.businessDate);
  const [sessionActionPending, setSessionActionPending] = useState(false);
  const noticeTimeoutRef = useRef(null);
  const latestSessionsRef = useRef(null);
  const cancellationPendingRef = useRef(false);

  const selectedStation = stations.find((station) => station.id === selectedStationId) ?? null;
  const handleClosePanel = useCallback(() => setSelectedStationId(null), []);
  const handleCloseForm = useCallback(() => setStationForm(null), []);
  const handleManageStations = useCallback(() => setView("dashboard"), []);

  const summary = useMemo(() => ({
    total: !stationsHydrated && stations.length === 0 ? null : stations.length,
    active: !stationsHydrated && stations.length === 0 ? null : stations.filter((station) => station.status === "active").length,
    paused: !stationsHydrated && stations.length === 0 ? null : stations.filter((station) => station.status === "paused").length,
    available: !stationsHydrated && stations.length === 0 ? null : stations.filter((station) => station.status === "available").length,
    finished: finishedToday,
  }), [finishedToday, stations, stationsHydrated]);

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
    let cancelled = false;
    let boundaryTimer;
    async function syncSessions() {
      try {
        const status = await fetchActiveSessions();
        if (cancelled) return;
        latestSessionsRef.current = status.sessions;
        const ids = {};
        for (const session of status.sessions) ids[session.stationId] = session.id;
        setSessionIds(ids);
        setFinishedToday(status.finishedToday);
        setBusinessDate(status.businessDate);
        setStations((currentStations) => currentStations.map((station) => {
          const session = status.sessions.find((item) => item.stationId === station.id);
          if (session) return stationFromSession(station, session);
          return ["active", "paused"].includes(station.status) ? resetStationSession(station) : station;
        }));
        const boundaryTimestamp = new Date(status.nextBusinessDayAt).getTime();
        const delay = Number.isFinite(boundaryTimestamp)
          ? Math.max(1000, boundaryTimestamp - Date.now() + 100)
          : 60_000;
        boundaryTimer = window.setTimeout(syncSessions, Math.min(delay, 2_147_000_000));
      } catch {
        // Station configuration can still load from local storage if sync fails.
        if (!cancelled) boundaryTimer = window.setTimeout(syncSessions, 30_000);
      }
    }
    syncSessions();
    return () => {
      cancelled = true;
      window.clearTimeout(boundaryTimer);
    };
  }, [setStations]);

  useEffect(() => {
    if (!stationsHydrated || !latestSessionsRef.current) return;
    const sessions = latestSessionsRef.current;
    setStations((currentStations) => currentStations.map((station) => {
      const session = sessions.find((item) => item.stationId === station.id);
      if (session) return stationFromSession(station, session);
      return ["active", "paused"].includes(station.status) ? resetStationSession(station) : station;
    }));
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

  const handleStart = useCallback(async (requestedControllerCount = 1) => {
    const station = stations.find((item) => item.id === selectedStationId);
    if (!station || sessionActionPending) return;
    setSessionActionPending(true);
    try {
      const controllerCount = station.type === "playstation" ? requestedControllerCount : undefined;
      const startTime = new Date(station.plannedStartAt ?? Date.now()).toISOString();
      const session = await startNewSession(station.id, station.hourlyRate, controllerCount, startTime);
      setSessionIds((current) => ({ ...current, [station.id]: session.id }));
      updateSelectedStation((current) => stationFromSession(current, session));
      showNotice(`${getStationName(station)} session started`);
    } catch (error) {
      showNotice(error.message || "Unable to start session");
    } finally {
      setSessionActionPending(false);
    }
  }, [selectedStationId, sessionActionPending, showNotice, stations, updateSelectedStation]);

  const handleResume = useCallback(async () => {
    const sessionId = sessionIds[selectedStationId];
    if (!sessionId || sessionActionPending) {
      showNotice("Live session record not found");
      return false;
    }
    setSessionActionPending(true);
    try {
      const session = await resumeSession(sessionId);
      updateSelectedStation((station) => stationFromSession(station, session));
      return true;
    } catch (error) {
      showNotice(error.message || "Unable to resume session");
      return false;
    } finally {
      setSessionActionPending(false);
    }
  }, [selectedStationId, sessionActionPending, sessionIds, showNotice, updateSelectedStation]);

  const handleBeginEnd = useCallback(async (stoppedAt) => {
    const currentStation = stations.find((station) => station.id === selectedStationId);
    const sessionId = sessionIds[selectedStationId];
    if (!currentStation || !sessionId || sessionActionPending) {
      showNotice("Live session record not found");
      return false;
    }
    if (currentStation.status === "paused") return true;

    setSessionActionPending(true);
    try {
      const session = await pauseSession(sessionId, new Date(stoppedAt).toISOString());
      updateSelectedStation((station) => stationFromSession(station, session));
      return true;
    } catch (error) {
      showNotice(error.message || "Unable to stop session");
      return false;
    } finally {
      setSessionActionPending(false);
    }
  }, [selectedStationId, sessionActionPending, sessionIds, showNotice, stations, updateSelectedStation]);

  const handleEnd = useCallback(async (endedAt) => {
    const currentStation = stations.find((station) => station.id === selectedStationId);
    const sessionId = sessionIds[selectedStationId];
    if (!currentStation || !sessionId || sessionActionPending) {
      showNotice("Live session record not found");
      return;
    }
    setSessionActionPending(true);
    try {
      const session = await endSession(sessionId, endedAt);
      updateSelectedStation(resetStationSession);
      setSessionIds((current) => {
        const next = { ...current };
        delete next[currentStation.id];
        return next;
      });
      setSelectedStationId(null);
      setFinishedToday((current) => current + 1);
      showNotice(`${getStationName(currentStation)} closed · Final total ${formatMoney(session.finalCost)}`);
    } catch (error) {
      showNotice(error.message || "Unable to end session");
    } finally {
      setSessionActionPending(false);
    }
  }, [selectedStationId, sessionActionPending, sessionIds, showNotice, stations, updateSelectedStation]);

  const handleCancel = useCallback(async () => {
    const currentStation = stations.find((station) => station.id === selectedStationId);
    const sessionId = sessionIds[selectedStationId];
    if (!currentStation || !sessionId || sessionActionPending || cancellationPendingRef.current) {
      if (!sessionActionPending && !cancellationPendingRef.current) showNotice("Live session record not found");
      return;
    }
    cancellationPendingRef.current = true;
    setSessionActionPending(true);
    try {
      await cancelSession(sessionId);
      latestSessionsRef.current = latestSessionsRef.current?.filter((session) => session.id !== sessionId) ?? null;
      updateSelectedStation(resetStationSession);
      setSessionIds((current) => {
        const next = { ...current };
        delete next[currentStation.id];
        return next;
      });
      setSelectedStationId(null);
      showNotice(`${getStationName(currentStation)} session cancelled`);
    } catch (error) {
      showNotice(error.message || "Unable to cancel session");
    } finally {
      cancellationPendingRef.current = false;
      setSessionActionPending(false);
    }
  }, [selectedStationId, sessionActionPending, sessionIds, showNotice, stations, updateSelectedStation]);

  const handleViewChange = useCallback((nextView) => {
    if (nextView !== "home" && nextView !== "employees" && !access.permissions.viewAnalytics) return;
    if (nextView === "employees" && !access.permissions.manageEmployees) return;
    setSelectedStationId(null);
    setView(nextView);
  }, [access.permissions.manageEmployees, access.permissions.viewAnalytics]);

  const handleRateChange = useCallback((value) => {
    const rate = Math.min(999, Math.max(0, Number(value) || 0));
    updateSelectedStation((station) => ({ ...station, hourlyRate: rate }));
    const sessionId = sessionIds[selectedStationId];
    if (sessionId) {
      updateSession(sessionId, { hourlyRate: rate })
        .catch(() => showNotice("Unable to update the live hourly rate"));
    }
  }, [selectedStationId, sessionIds, showNotice, updateSelectedStation]);

  const handleControllerCountChange = useCallback(async (value) => {
    const controllerCount = Math.min(99, Math.max(1, Number(value) || 1));
    const previousControllerCount = Number(selectedStation?.controllerCount) || 1;
    const sessionId = sessionIds[selectedStationId];
    if (!sessionId || selectedStation?.type !== "playstation" || sessionActionPending) return;

    updateSelectedStation((station) => ({ ...station, controllerCount }));
    setSessionActionPending(true);
    try {
      const session = await updateSession(sessionId, { controllerCount });
      updateSelectedStation((station) => ({ ...station, controllerCount: session.controllerCount }));
    } catch (error) {
      updateSelectedStation((station) => ({ ...station, controllerCount: previousControllerCount }));
      showNotice(error.message || "Unable to update the controller count");
    } finally {
      setSessionActionPending(false);
    }
  }, [selectedStation, selectedStationId, sessionActionPending, sessionIds, showNotice, updateSelectedStation]);

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />

      <main className="dashboard">
        <Header summary={summary} view={view} onViewChange={handleViewChange} onSignOut={onSignOut} permissions={access.permissions} />
        {view === "home" ? (
          <Home
            stations={stations}
            stationsHydrated={stationsHydrated}
            selectedStationId={selectedStationId}
            onSelect={setSelectedStationId}
            onManageStations={access.permissions.manageStations ? handleManageStations : null}
          />
        ) : view === "dashboard" && access.permissions.manageStations ? (
          <Suspense fallback={<div className="analytics-skeleton" aria-label="Loading dashboard"><div className="skeleton-panel skeleton-panel--tall" /></div>}><Dashboard
            stations={stations}
            onAdd={() => setStationForm({ station: null })}
            onEdit={(station) => setStationForm({ station })}
            onDelete={handleDeleteStation}
          /></Suspense>
        ) : view === "employees" && access.permissions.manageEmployees ? <Suspense fallback={<div className="analytics-skeleton" aria-label="Loading employees"><div className="skeleton-panel skeleton-panel--tall" /></div>}><Employees /></Suspense> : <Suspense fallback={<div className="analytics-skeleton" aria-label="Loading analytics"><div className="skeleton-panel skeleton-panel--tall" /></div>}><BusinessAnalytics key={businessDate} businessDate={businessDate} onBack={() => handleViewChange("dashboard")} /></Suspense>}
      </main>

      {selectedStation && (
        <Suspense fallback={null}><SessionPanel
          station={selectedStation}
          onClose={handleClosePanel}
          onRateChange={handleRateChange}
          onControllerCountChange={handleControllerCountChange}
          onStartTimeChange={handleStartTimeChange}
          onStart={handleStart}
          onResume={handleResume}
          onBeginEnd={handleBeginEnd}
          onKeep={handleResume}
          onEnd={handleEnd}
          onCancel={handleCancel}
          timezone={access.tenant.timezone}
          busy={sessionActionPending}
        /></Suspense>
      )}

      {stationForm && access.permissions.manageStations && (
        <Suspense fallback={null}><StationForm station={stationForm.station} stations={stations} onClose={handleCloseForm} onSave={handleSaveStation} /></Suspense>
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
    controllerCount: session.controllerCount ?? 1,
    sessionStartAt: session.startedAt ? new Date(session.startedAt).getTime() : null,
    pausedAt: session.pausedAt ? new Date(session.pausedAt).getTime() : null,
    totalPausedMs: Number(session.totalPausedSeconds || 0) * 1000,
    pauseIntervals: session.pauseIntervals ?? [],
    plannedStartAt: null,
  };
}

function resetStationSession(station) {
  return { ...station, status: "available", sessionStartAt: null, pausedAt: null, totalPausedMs: 0, pauseIntervals: [], plannedStartAt: null, controllerCount: 1 };
}
