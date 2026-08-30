const types = new Set(["billiard", "pingpong", "playstation"]);
// Station IDs predate the UUID-only frontend and are stored as text in the
// database. Keep accepting those existing IDs when the complete station list
// is synchronized, otherwise any edit or deletion is rejected with a 400.
const stationIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

function normalizeStation(station) {
  if (
    !station || typeof station.id !== "string" || !stationIdPattern.test(station.id) ||
    !types.has(station.type) || !Number.isInteger(Number(station.number)) ||
    Number(station.number) < 1 || Number(station.number) > 999 ||
    !Number.isFinite(Number(station.hourlyRate)) || Number(station.hourlyRate) < 0 ||
    Number(station.hourlyRate) > 999
  ) return null;

  return {
    id: station.id,
    type: station.type,
    number: Number(station.number),
    hourlyRate: Number(station.hourlyRate),
  };
}

export function validateStationSync(request) {
  if (!Array.isArray(request.body?.stations)) {
    return { success: false, errors: ["stations must be an array"] };
  }
  if (request.body.stations.length > 300) {
    return { success: false, errors: ["stations cannot contain more than 300 items"] };
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
