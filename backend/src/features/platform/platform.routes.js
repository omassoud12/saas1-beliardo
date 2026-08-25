import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePlatformAdmin } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { changeOwnerStatus, changeUserStatus, listAuditLogs, listOwners, listUsers, removeUser, updateUser } from "./platform.controller.js";
import { validateOwnerStatus, validateUserId, validateUserStatus, validateUserUpdate } from "./platform.validation.js";

const router = Router();
router.use(authenticate, requirePlatformAdmin);
router.get("/owners", listOwners);
router.get("/users", listUsers);
router.patch("/owners/:userId/status", validateRequest(validateOwnerStatus), changeOwnerStatus);
router.patch("/users/:userId", validateRequest(validateUserUpdate), updateUser);
router.patch("/users/:userId/status", validateRequest(validateUserStatus), changeUserStatus);
router.delete("/users/:userId", validateRequest(validateUserId), removeUser);
router.get("/audit-logs", listAuditLogs);
export default router;
