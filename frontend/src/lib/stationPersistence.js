export function stationConfigurationSignature(stations) {
  return JSON.stringify(stations.map(({ id, type, number, hourlyRate, exchangeRate, plannedStartAt }) => ({
    id, type, number, hourlyRate, exchangeRate: exchangeRate ?? null, plannedStartAt: plannedStartAt ?? null,
  })));
}
