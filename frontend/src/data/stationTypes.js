export const STATION_TYPE_ORDER = ["billiard", "pingpong", "playstation"];

export const STATION_TYPES = {
  billiard: {
    value: "billiard",
    label: "Billiard",
    cardLabel: "Table",
    sessionLabel: "Billiard table",
    countLabel: "tables",
  },
  pingpong: {
    value: "pingpong",
    label: "Ping Pong",
    cardLabel: "Ping Pong",
    sessionLabel: "Ping Pong",
    countLabel: "tables",
  },
  playstation: {
    value: "playstation",
    label: "PlayStation",
    cardLabel: "PS",
    sessionLabel: "PlayStation",
    countLabel: "stations",
  },
};

export function getStationName(station) {
  const type = STATION_TYPES[station.type] ?? STATION_TYPES.billiard;
  return `${type.sessionLabel} ${String(station.number).padStart(2, "0")}`;
}

export function createStation({ type, number, hourlyRate }) {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `station-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    number: Number(number),
    hourlyRate: Number(hourlyRate),
    status: "available",
    sessionStartAt: null,
    pausedAt: null,
    totalPausedMs: 0,
    plannedStartAt: null,
  };
}

export function sortStations(stations) {
  return [...stations].sort((a, b) => {
    const typeDifference = STATION_TYPE_ORDER.indexOf(a.type) - STATION_TYPE_ORDER.indexOf(b.type);
    return typeDifference || a.number - b.number;
  });
}
