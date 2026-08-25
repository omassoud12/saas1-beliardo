import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireApprovedOwner } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { getDailySummary, getMonthlySummary, getYearlySummary } from "./business.controller.js";
import { validateDailySummary, validateMonthlySummary, validateYearlySummary } from "./business.validation.js";

const router = Router();
router.use(authenticate);
router.use(requireApprovedOwner);
router.get("/daily", validateRequest(validateDailySummary), getDailySummary);
router.get("/monthly", validateRequest(validateMonthlySummary), getMonthlySummary);
router.get("/yearly", validateRequest(validateYearlySummary), getYearlySummary);

export default router;
