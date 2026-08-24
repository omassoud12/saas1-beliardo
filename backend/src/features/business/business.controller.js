import { sendSuccess } from "../../shared/utils/response.js";
import { businessService } from "./business.service.js";

function action(method) {
  return async (request, response, next) => {
    try {
      const summary = await businessService[method]({
        businessId: request.auth.businessId,
        timezone: request.auth.timezone,
        ...request.validated,
      });
      return sendSuccess(response, { data: { summary } });
    } catch (error) {
      return next(error);
    }
  };
}

export const getDailySummary = action("daily");
export const getMonthlySummary = action("monthly");
export const getYearlySummary = action("yearly");
