import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import {
  createSession, deleteSession, endSession, getActiveSessions, getCompletedSessions,
  getSession, pauseSession, resumeSession, startSession, updateSession,
} from "./session.controller.js";
import {
  validateCompletedSessions, validateCreateSession, validateSessionId,
  validateStartSession, validateUpdateSession,
} from "./session.validation.js";

const router = Router();
router.use(authenticate);

router.post("/", validateRequest(validateCreateSession), createSession);
router.get("/active", getActiveSessions);
router.get("/completed", validateRequest(validateCompletedSessions), getCompletedSessions);
router.get("/:id", validateRequest(validateSessionId), getSession);
router.post("/:id/start", validateRequest(validateStartSession), startSession);
router.post("/:id/pause", validateRequest(validateSessionId), pauseSession);
router.post("/:id/resume", validateRequest(validateSessionId), resumeSession);
router.patch("/:id", validateRequest(validateUpdateSession), updateSession);
router.post("/:id/end", validateRequest(validateSessionId), endSession);
router.delete("/:id", validateRequest(validateSessionId), deleteSession);

export default router;
