const types = new Set(["billiard", "pingpong", "playstation"]);
const statuses = new Set(["available", "active", "paused"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeStation(station) {
  if (
    !station || typeof station.id !== "string" || !uuidPattern.test(station.id) ||
    !types.has(station.type) || !Number.isInteger(Number(station.number)) ||
    Number(station.number) < 1 || Number(station.number) > 999 ||
    !Number.isFinite(Number(station.hourlyRate)) || Number(station.hourlyRate) < 0 ||
    Number(station.hourlyRate) > 999 || !statuses.has(station.status)
  ) return null;

  return {
    id: station.id,
    type: station.type,
    number: Number(station.number),
    hourlyRate: Number(station.hourlyRate),
    status: station.status,
    sessionStartAt: station.sessionStartAt ?? null,
    pausedAt: station.pausedAt ?? null,
    totalPausedMs: Math.max(0, Number(station.totalPausedMs) || 0),
    plannedStartAt: station.plannedStartAt ?? null,
  };
}

export function validateStationSync(request) {
  if (!Array.isArray(request.body?.stations)) {
    return { success: false, errors: ["stations must be an array"] };
  }
  const stations = request.body.stations.map(normalizeStation);
  if (stations.some((station) => !station)) {
    return { success: false, errors: ["One or more stations are invalid"] };
  }
  const keys = stations.map((station) => `${station.type}:${station.number}`);
  if (new Set(keys).size !== keys.length) {
    return { success: false, errors: ["Station numbers must be unique within each type"] };
  }
  return { success: true, data: { stations } };
}
