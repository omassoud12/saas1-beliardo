import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireApprovedOwner, requireHomeAccess } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  editCompletedSession, cancelSession, deleteSession, endSession, getActiveSessions, getCompletedSessions,
  getSession, getTodayActivities, pauseSession, resumeSession, startNewSession, updateSession,
} from "./session.controller.js";
import {
  validateCompletedSessionEdit, validateCompletedSessions, validateEndSession, validatePauseSession, validateSessionId,
  validateStartNewSession, validateUpdateSession,
} from "./session.validation.js";
import { sessionMutationRateLimiter } from "../../middleware/security.js";

const router = Router();
router.use(authenticate);
router.use(requireHomeAccess);

router.post("/start", sessionMutationRateLimiter, validateRequest(validateStartNewSession), startNewSession);
router.get("/active", getActiveSessions);
router.get("/activity/today", getTodayActivities);
router.get("/completed", requireApprovedOwner, validateRequest(validateCompletedSessions), getCompletedSessions);
router.get("/:id", validateRequest(validateSessionId), getSession);
router.post("/:id/pause", sessionMutationRateLimiter, validateRequest(validatePauseSession), pauseSession);
router.post("/:id/resume", sessionMutationRateLimiter, validateRequest(validateSessionId), resumeSession);
router.patch("/:id/completed", sessionMutationRateLimiter, validateRequest(validateCompletedSessionEdit), editCompletedSession);
router.patch("/:id", sessionMutationRateLimiter, validateRequest(validateUpdateSession), updateSession);
router.post("/:id/cancel", sessionMutationRateLimiter, validateRequest(validateSessionId), cancelSession);
router.post("/:id/end", sessionMutationRateLimiter, validateRequest(validateEndSession), endSession);
router.delete("/:id", sessionMutationRateLimiter, validateRequest(validateSessionId), deleteSession);

export default router;
