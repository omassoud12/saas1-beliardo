import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireApprovedOwner } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { getDashboardChart, getDashboardSummary } from "./dashboard.controller.js";
import { validateChartRequest, validateDashboardPeriod } from "./dashboard.validation.js";
import { analyticsRateLimiter } from "../../middleware/security.js";

const router = Router();
router.use(authenticate);
router.use(requireApprovedOwner);
router.get("/summary/:period", analyticsRateLimiter, validateRequest(validateDashboardPeriod), getDashboardSummary);
router.get("/charts/:granularity", analyticsRateLimiter, validateRequest(validateChartRequest), getDashboardChart);

export default router;
