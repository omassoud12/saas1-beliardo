import { stationRepository } from "./station.repository.js";
import { AppError } from "../../shared/errors/AppError.js";

export function createStationService({ repository = stationRepository } = {}) {
  return {
    list(businessId) {
      return repository.list(businessId);
    },

    async sync(businessId, stations) {
      const ownedRows = await repository.findOwnedIds(stations.map((station) => station.id));
      if (ownedRows.some((station) => station.business_id !== businessId)) {
        throw new AppError(409, "A station ID is already used by another business", "STATION_ID_CONFLICT");
      }
      const existingStations = await repository.list(businessId);
      const existingIds = existingStations.map((station) => station.id);
      const incomingIds = new Set(stations.map((station) => station.id));
      const removedStations = existingStations.filter((station) => !incomingIds.has(station.id));
      if (removedStations.some((station) => ["active", "paused"].includes(station.status))) {
        throw new AppError(409, "End or cancel the live session before deleting its station", "STATION_IN_USE");
      }
      await repository.upsert(businessId, stations);
      await repository.archiveByIds(
        businessId,
        existingIds.filter((id) => !incomingIds.has(id)),
      );
      return repository.list(businessId);
    },
  };
}

export const stationService = createStationService();
