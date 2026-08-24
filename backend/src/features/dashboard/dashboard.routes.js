import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { getDashboardChart, getDashboardSummary } from "./dashboard.controller.js";
import { validateChartRequest, validateDashboardPeriod } from "./dashboard.validation.js";

const router = Router();
router.use(authenticate);
router.get("/summary/:period", validateRequest(validateDashboardPeriod), getDashboardSummary);
router.get("/charts/:granularity", validateRequest(validateChartRequest), getDashboardChart);

export default router;
