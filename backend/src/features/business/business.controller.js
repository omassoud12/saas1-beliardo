import { sendSuccess } from "../../shared/utils/response.js";
import { businessService } from "./business.service.js";
import { businessAnalysisService } from "./business-analysis.service.js";
import { businessOverviewService } from "./business-overview.service.js";

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

export async function getBusinessAnalysis(request, response, next) {
  try {
    const analysis = await businessAnalysisService.analyze({
      businessId: request.auth.businessId,
      timezone: request.auth.timezone,
      ...request.validated,
    });
    return sendSuccess(response, { data: { analysis } });
  } catch (error) { return next(error); }
}

export async function getBusinessOverview(request, response, next) {
  try {
    const overview = await businessOverviewService.load({
      businessId: request.auth.businessId,
      timezone: request.auth.timezone,
      ...request.validated,
    });
    return sendSuccess(response, { data: { overview } });
  } catch (error) { return next(error); }
}

export async function listBusinessExpenses(request, response, next) {
  try {
    const result = await businessAnalysisService.listExpensePage(request.auth.businessId, request.validated);
    const { items, ...pagination } = result;
    return sendSuccess(response, { data: { expenses: items, pagination } });
  } catch (error) { return next(error); }
}

export async function listBusinessExpenseHistory(request, response, next) {
  try {
    const result = await businessAnalysisService.listExpensePage(request.auth.businessId, request.validated, true);
    const { items, ...pagination } = result;
    return sendSuccess(response, { data: { expenses: items, pagination } });
  } catch (error) { return next(error); }
}

export async function getStationPerformance(request, response, next) {
  try {
    const stationPerformance = await businessAnalysisService.stationPerformance({
      businessId: request.auth.businessId,
      timezone: request.auth.timezone,
      ...request.validated,
    });
    return sendSuccess(response, { data: { stationPerformance } });
  } catch (error) { return next(error); }
}

export async function createBusinessExpense(request, response, next) {
  try {
    const expense = await businessAnalysisService.saveExpense({
      businessId: request.auth.businessId, userId: request.auth.user.id,
      timezone: request.auth.timezone, values: request.validated,
    });
    return sendSuccess(response, { statusCode: 201, data: { expense }, message: "Expense created" });
  } catch (error) { return next(error); }
}

export async function updateBusinessExpense(request, response, next) {
  try {
    const expense = await businessAnalysisService.saveExpense({
      businessId: request.auth.businessId, userId: request.auth.user.id,
      timezone: request.auth.timezone, expenseId: request.validated.expenseId, values: request.validated.values,
    });
    return sendSuccess(response, { data: { expense }, message: "Expense updated" });
  } catch (error) { return next(error); }
}

export async function deleteBusinessExpense(request, response, next) {
  try {
    await businessAnalysisService.deleteExpense({
      businessId: request.auth.businessId, userId: request.auth.user.id,
      timezone: request.auth.timezone, expenseId: request.validated.expenseId,
    });
    return sendSuccess(response, { message: "Expense deleted" });
  } catch (error) { return next(error); }
}

export async function listBusinessTargets(request, response, next) {
  try {
    const result = await businessAnalysisService.listTargetPage(request.auth.businessId, request.validated);
    const { items, ...pagination } = result;
    return sendSuccess(response, { data: { targets: items, pagination } });
  } catch (error) { return next(error); }
}

export async function createBusinessTarget(request, response, next) {
  try {
    const target = await businessAnalysisService.saveTarget({
      businessId: request.auth.businessId, userId: request.auth.user.id,
      timezone: request.auth.timezone, values: request.validated,
    });
    return sendSuccess(response, { statusCode: 201, data: { target }, message: "Target created" });
  } catch (error) { return next(error); }
}

export async function updateBusinessTarget(request, response, next) {
  try {
    const target = await businessAnalysisService.saveTarget({
      businessId: request.auth.businessId, userId: request.auth.user.id,
      timezone: request.auth.timezone,
      targetId: request.validated.targetId, values: request.validated.values,
    });
    return sendSuccess(response, { data: { target }, message: "Target updated" });
  } catch (error) { return next(error); }
}

export async function deleteBusinessTarget(request, response, next) {
  try {
    await businessAnalysisService.deleteTarget({
      businessId: request.auth.businessId, userId: request.auth.user.id,
      timezone: request.auth.timezone, targetId: request.validated.targetId,
    });
    return sendSuccess(response, { message: "Target deleted" });
  } catch (error) { return next(error); }
}
