import { sendSuccess } from "../../shared/utils/response.js";
import { businessHistoricalService } from "./business-historical.service.js";

export async function previewHistoricalImport(request, response, next) {
  try {
    const preview = await businessHistoricalService.preview({
      businessId: request.auth.businessId,
      userId: request.auth.user.id,
      payload: request.validated,
    });
    return sendSuccess(response, { data: { preview } });
  } catch (error) { return next(error); }
}

export async function confirmHistoricalImport(request, response, next) {
  try {
    const historicalImport = await businessHistoricalService.confirm({
      businessId: request.auth.businessId,
      userId: request.auth.user.id,
      payload: request.validated,
    });
    return sendSuccess(response, { statusCode: 201, data: { historicalImport }, message: "Historical data imported" });
  } catch (error) { return next(error); }
}

export async function listHistoricalImports(request, response, next) {
  try {
    const result = await businessHistoricalService.list(request.auth.businessId, request.validated);
    const { items, ...pagination } = result;
    return sendSuccess(response, { data: { imports: items, pagination } });
  } catch (error) { return next(error); }
}
