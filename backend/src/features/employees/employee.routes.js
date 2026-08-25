import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireApprovedOwner } from "../../middleware/accessGuards.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { acceptInvitation, changeEmployeeStatus, inviteEmployee, listEmployees, listInvitations, resendInvitation, revokeInvitation } from "./employee.controller.js";
import { validateAcceptInvitation, validateEmployeeStatus, validateInvitation, validateInvitationId } from "./employee.validation.js";

const router = Router();
router.post("/invitations/accept", authenticate, validateRequest(validateAcceptInvitation), acceptInvitation);
router.use(authenticate, requireApprovedOwner);
router.get("/", listEmployees);
router.get("/invitations", listInvitations);
router.post("/invitations", validateRequest(validateInvitation), inviteEmployee);
router.post("/invitations/:invitationId/resend", validateRequest(validateInvitationId), resendInvitation);
router.delete("/invitations/:invitationId", validateRequest(validateInvitationId), revokeInvitation);
router.patch("/:userId/status", validateRequest(validateEmployeeStatus), changeEmployeeStatus);
export default router;
