import { sendSuccess } from "../../shared/utils/response.js";
import { businessService } from "./business.service.js";
import { businessAnalysisService } from "./business-analysis.service.js";

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

export async function listBusinessExpenses(request, response, next) {
  try {
    return sendSuccess(response, { data: { expenses: await businessAnalysisService.listExpenses(request.auth.businessId) } });
  } catch (error) { return next(error); }
}

export async function createBusinessExpense(request, response, next) {
  try {
    const expense = await businessAnalysisService.saveExpense({
      businessId: request.auth.businessId, userId: request.auth.user.id, values: request.validated,
    });
    return sendSuccess(response, { statusCode: 201, data: { expense }, message: "Expense created" });
  } catch (error) { return next(error); }
}

export async function updateBusinessExpense(request, response, next) {
  try {
    const expense = await businessAnalysisService.saveExpense({
      businessId: request.auth.businessId, userId: request.auth.user.id,
      expenseId: request.validated.expenseId, values: request.validated.values,
    });
    return sendSuccess(response, { data: { expense }, message: "Expense updated" });
  } catch (error) { return next(error); }
}

export async function deleteBusinessExpense(request, response, next) {
  try {
    await businessAnalysisService.deleteExpense({
      businessId: request.auth.businessId, userId: request.auth.user.id, expenseId: request.validated.expenseId,
    });
    return sendSuccess(response, { message: "Expense deleted" });
  } catch (error) { return next(error); }
}

export async function listBusinessTargets(request, response, next) {
  try {
    return sendSuccess(response, { data: { targets: await businessAnalysisService.listTargets(request.auth.businessId) } });
  } catch (error) { return next(error); }
}

export async function createBusinessTarget(request, response, next) {
  try {
    const target = await businessAnalysisService.saveTarget({
      businessId: request.auth.businessId, userId: request.auth.user.id, values: request.validated,
    });
    return sendSuccess(response, { statusCode: 201, data: { target }, message: "Target created" });
  } catch (error) { return next(error); }
}

export async function updateBusinessTarget(request, response, next) {
  try {
    const target = await businessAnalysisService.saveTarget({
      businessId: request.auth.businessId, userId: request.auth.user.id,
      targetId: request.validated.targetId, values: request.validated.values,
    });
    return sendSuccess(response, { data: { target }, message: "Target updated" });
  } catch (error) { return next(error); }
}

export async function deleteBusinessTarget(request, response, next) {
  try {
    await businessAnalysisService.deleteTarget({
      businessId: request.auth.businessId, userId: request.auth.user.id, targetId: request.validated.targetId,
    });
    return sendSuccess(response, { message: "Target deleted" });
  } catch (error) { return next(error); }
}
