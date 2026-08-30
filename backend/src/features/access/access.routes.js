import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { getMyAccess, updatePassword } from "./access.controller.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { validatePasswordUpdate } from "./access.validation.js";
import { passwordUpdateRateLimiter } from "../../middleware/security.js";

const router = Router();
router.get("/me", authenticate, getMyAccess);
router.post("/password", passwordUpdateRateLimiter, authenticate, validateRequest(validatePasswordUpdate), updatePassword);
export default router;
