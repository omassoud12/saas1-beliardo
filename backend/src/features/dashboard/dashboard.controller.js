import { sendSuccess } from "../../shared/utils/response.js";
import { dashboardService } from "./dashboard.service.js";

export async function getDashboardSummary(request, response, next) {
  try {
    const summary = await dashboardService.getSummary({
      businessId: request.auth.businessId,
      timezone: request.auth.timezone,
      period: request.validated.period,
    });
    return sendSuccess(response, { data: { summary } });
  } catch (error) { return next(error); }
}

export async function getDashboardChart(request, response, next) {
  try {
    const chart = await dashboardService.getChart({
      businessId: request.auth.businessId,
      timezone: request.auth.timezone,
      ...request.validated,
    });
    return sendSuccess(response, { data: { chart } });
  } catch (error) { return next(error); }
}
