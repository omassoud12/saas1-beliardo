import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireApprovedOwner } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  createBusinessExpense, createBusinessTarget, deleteBusinessExpense, deleteBusinessTarget, getBusinessAnalysis,
  getBusinessOverview, getDailySummary, getMonthlySummary, getStationPerformance, getYearlySummary, listBusinessExpenseHistory, listBusinessExpenses,
  listBusinessTargets, updateBusinessExpense, updateBusinessTarget,
} from "./business.controller.js";
import { downloadSavedBusinessReport, generateBusinessReport, listBusinessReports } from "./business-report.controller.js";
import { validateBusinessReport, validateBusinessReportId } from "./business-report.validation.js";
import {
  validateBusinessAnalysis, validateDailySummary, validateExpense, validateExpenseId,
  validateExpenseUpdate, validateMonthlySummary, validatePagination, validateTarget, validateTargetId,
  validateTargetUpdate, validateYearlySummary,
} from "./business.validation.js";
import { analyticsRateLimiter, pdfDownloadRateLimiter, pdfGenerationRateLimiter } from "../../middleware/security.js";

const router = Router();
router.use(authenticate);
router.use(requireApprovedOwner);
router.get("/daily", analyticsRateLimiter, validateRequest(validateDailySummary), getDailySummary);
router.get("/monthly", analyticsRateLimiter, validateRequest(validateMonthlySummary), getMonthlySummary);
router.get("/yearly", analyticsRateLimiter, validateRequest(validateYearlySummary), getYearlySummary);
router.get("/analysis", analyticsRateLimiter, validateRequest(validateBusinessAnalysis), getBusinessAnalysis);
router.get("/overview", analyticsRateLimiter, validateRequest(validateBusinessAnalysis), getBusinessOverview);
router.get("/station-performance", analyticsRateLimiter, validateRequest(validateBusinessAnalysis), getStationPerformance);
router.get("/expenses/history", validateRequest(validatePagination), listBusinessExpenseHistory);
router.get("/expenses", validateRequest(validatePagination), listBusinessExpenses);
router.post("/expenses", validateRequest(validateExpense), createBusinessExpense);
router.patch("/expenses/:expenseId", validateRequest(validateExpenseUpdate), updateBusinessExpense);
router.delete("/expenses/:expenseId", validateRequest(validateExpenseId), deleteBusinessExpense);
router.get("/targets", validateRequest(validatePagination), listBusinessTargets);
router.post("/targets", validateRequest(validateTarget), createBusinessTarget);
router.patch("/targets/:targetId", validateRequest(validateTargetUpdate), updateBusinessTarget);
router.delete("/targets/:targetId", validateRequest(validateTargetId), deleteBusinessTarget);
router.get("/reports", validateRequest(validatePagination), listBusinessReports);
router.get("/reports/:reportId/pdf", pdfDownloadRateLimiter, validateRequest(validateBusinessReportId), downloadSavedBusinessReport);
router.post("/reports/pdf", pdfGenerationRateLimiter, validateRequest(validateBusinessReport), generateBusinessReport);

export default router;
