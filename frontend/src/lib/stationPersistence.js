export function stationConfigurationSignature(stations) {
  return JSON.stringify(stations.map(({ id, type, number, hourlyRate, plannedStartAt }) => ({
    id, type, number, hourlyRate, plannedStartAt: plannedStartAt ?? null,
  })));
}
