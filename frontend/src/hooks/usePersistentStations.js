import { useEffect, useState } from "react";
import { STATION_TYPES, sortStations } from "../data/stationTypes";
import { fetchStations, syncStations } from "../lib/api";

const STORAGE_KEY = "billiard-hall.stations.v1";

function loadStations() {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) return [];

    const parsed = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) return [];

    return sortStations(parsed.filter((station) => (
      station &&
      typeof station.id === "string" &&
      STATION_TYPES[station.type] &&
      Number.isInteger(Number(station.number)) &&
      Number(station.number) > 0 &&
      Number.isFinite(Number(station.hourlyRate))
    )).map((station) => ({
      ...station,
      number: Number(station.number),
      hourlyRate: Number(station.hourlyRate),
      status: ["available", "active", "paused"].includes(station.status)
        ? station.status
        : "available",
      sessionStartAt: station.sessionStartAt ?? null,
      pausedAt: station.pausedAt ?? null,
      totalPausedMs: Number(station.totalPausedMs) || 0,
      plannedStartAt: station.plannedStartAt ?? null,
    })));
  } catch {
    return [];
  }
}

export function usePersistentStations() {
  const [stations, setStations] = useState(loadStations);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stations));
    } catch {
      // The application remains usable in memory if storage is unavailable.
    }
  }, [stations]);

  useEffect(() => {
    let isMounted = true;

    fetchStations()
      .then((remoteStations) => {
        if (!isMounted) return;

        const normalizedRemoteStations = sortStations(remoteStations);
        setStations((currentStations) => (
          normalizedRemoteStations.length === 0 && currentStations.length > 0
            ? currentStations
            : normalizedRemoteStations
        ));
        setIsHydrated(true);
      })
      .catch(() => {
        if (isMounted) setIsHydrated(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    syncStations(stations).catch(() => {
      // Local state remains usable if the backend is temporarily unavailable.
    });
  }, [isHydrated, stations]);

  return [stations, setStations];
}
