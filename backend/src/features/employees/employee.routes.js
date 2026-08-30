import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireApprovedOwner } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { acceptInvitation, changeEmployeeStatus, inviteEmployee, listEmployees, listInvitations, resendInvitation, revokeInvitation } from "./employee.controller.js";
import { validateAcceptInvitation, validateEmployeeStatus, validateInvitation, validateInvitationId } from "./employee.validation.js";
import { invitationAcceptanceRateLimiter, invitationMutationRateLimiter } from "../../middleware/security.js";

const router = Router();
router.post("/invitations/accept", invitationAcceptanceRateLimiter, authenticate, validateRequest(validateAcceptInvitation), acceptInvitation);
router.use(authenticate, requireApprovedOwner);
router.get("/", listEmployees);
router.get("/invitations", listInvitations);
router.post("/invitations", invitationMutationRateLimiter, validateRequest(validateInvitation), inviteEmployee);
router.post("/invitations/:invitationId/resend", invitationMutationRateLimiter, validateRequest(validateInvitationId), resendInvitation);
router.delete("/invitations/:invitationId", invitationMutationRateLimiter, validateRequest(validateInvitationId), revokeInvitation);
router.patch("/:userId/status", invitationMutationRateLimiter, validateRequest(validateEmployeeStatus), changeEmployeeStatus);
export default router;
