import { stationRepository } from "./station.repository.js";
import { AppError } from "../../shared/errors/AppError.js";

export function createStationService({ repository = stationRepository } = {}) {
  return {
    list(businessId) {
      return repository.list(businessId);
    },

    async sync(businessId, actorUserId, stations) {
      const result = await repository.sync(businessId, actorUserId, stations);
      if (result.outcome === "forbidden") throw new AppError(403, "Station synchronization is not permitted", "FORBIDDEN");
      if (result.outcome === "id_conflict") throw new AppError(409, "A station ID is already used by another business", "STATION_ID_CONFLICT");
      if (result.outcome === "station_in_use") throw new AppError(409, "End or cancel the live session before deleting its station", "STATION_IN_USE");
      if (result.outcome === "too_many_stations") throw new AppError(400, "A maximum of 300 stations is allowed", "TOO_MANY_STATIONS");
      if (result.outcome === "invalid_stations") throw new AppError(400, "One or more stations are invalid", "INVALID_STATIONS");
      if (result.outcome === "conflict") throw new AppError(409, "Station numbers or IDs conflict", "STATION_CONFLICT");
      if (result.outcome !== "synchronized") throw new AppError(409, "Unable to synchronize stations", "STATION_SYNC_FAILED");
      return result.stations;
    },
  };
}

export const stationService = createStationService();
