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
      const existingIds = await repository.listIds(businessId);
      const incomingIds = new Set(stations.map((station) => station.id));
      await repository.upsert(businessId, stations);
      await repository.removeByIds(
        businessId,
        existingIds.filter((id) => !incomingIds.has(id)),
      );
      return repository.list(businessId);
    },
  };
}

export const stationService = createStationService();
