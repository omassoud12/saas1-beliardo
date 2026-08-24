import { sendSuccess } from "../../shared/utils/response.js";
import { stationService } from "./station.service.js";

export async function listStations(request, response, next) {
  try {
    const stations = await stationService.list(request.auth.businessId);
    return sendSuccess(response, { data: { stations } });
  } catch (error) { return next(error); }
}

export async function syncStations(request, response, next) {
  try {
    const stations = await stationService.sync(request.auth.businessId, request.validated.stations);
    return sendSuccess(response, { data: { stations }, message: "Stations synchronized" });
  } catch (error) { return next(error); }
}
