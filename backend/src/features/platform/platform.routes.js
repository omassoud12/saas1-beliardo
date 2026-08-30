import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePlatformAdmin } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { changeOwnerStatus, changeUserStatus, listAuditLogs, listOwners, listUsers, removeUser, updateUser } from "./platform.controller.js";
import { validateOwnerStatus, validateUserId, validateUserStatus, validateUserUpdate } from "./platform.validation.js";
import { platformMutationRateLimiter } from "../../middleware/security.js";

const router = Router();
router.use(authenticate, requirePlatformAdmin);
router.get("/owners", listOwners);
router.get("/users", listUsers);
router.patch("/owners/:userId/status", platformMutationRateLimiter, validateRequest(validateOwnerStatus), changeOwnerStatus);
router.patch("/users/:userId", platformMutationRateLimiter, validateRequest(validateUserUpdate), updateUser);
router.patch("/users/:userId/status", platformMutationRateLimiter, validateRequest(validateUserStatus), changeUserStatus);
router.delete("/users/:userId", platformMutationRateLimiter, validateRequest(validateUserId), removeUser);
router.get("/audit-logs", listAuditLogs);
export default router;
