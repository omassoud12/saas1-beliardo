import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireApprovedOwner, requireHomeAccess } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  cancelSession, createSession, deleteSession, endSession, getActiveSessions, getCompletedSessions,
  getSession, pauseSession, resumeSession, startSession, updateSession,
} from "./session.controller.js";
import {
  validateCompletedSessions, validateCreateSession, validateEndSession, validatePauseSession, validateSessionId,
  validateStartSession, validateUpdateSession,
} from "./session.validation.js";

const router = Router();
router.use(authenticate);
router.use(requireHomeAccess);

router.post("/", validateRequest(validateCreateSession), createSession);
router.get("/active", getActiveSessions);
router.get("/completed", requireApprovedOwner, validateRequest(validateCompletedSessions), getCompletedSessions);
router.get("/:id", validateRequest(validateSessionId), getSession);
router.post("/:id/start", validateRequest(validateStartSession), startSession);
router.post("/:id/pause", validateRequest(validatePauseSession), pauseSession);
router.post("/:id/resume", validateRequest(validateSessionId), resumeSession);
router.patch("/:id", validateRequest(validateUpdateSession), updateSession);
router.post("/:id/cancel", validateRequest(validateSessionId), cancelSession);
router.post("/:id/end", validateRequest(validateEndSession), endSession);
router.delete("/:id", validateRequest(validateSessionId), deleteSession);

export default router;
