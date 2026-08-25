import { useEffect, useState } from "react";
import { STATION_TYPES, sortStations } from "../data/stationTypes";
import { fetchStations, syncStations } from "../lib/api";

const storageKeyFor = (businessId) => `billiard-hall.stations.v2.${businessId}`;

function loadStations(storageKey) {
  try {
    const storedValue = window.localStorage.getItem(storageKey);
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

export function usePersistentStations({ businessId, canManage = true } = {}) {
  const storageKey = storageKeyFor(businessId);
  const [stations, setStations] = useState(() => loadStations(storageKey));
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(stations));
    } catch {
      // The application remains usable in memory if storage is unavailable.
    }
  }, [stations, storageKey]);

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
    if (!isHydrated || !canManage) return;

    syncStations(stations).catch(() => {
      // Local state remains usable if the backend is temporarily unavailable.
    });
  }, [canManage, isHydrated, stations]);

  return [stations, setStations, isHydrated];
}
