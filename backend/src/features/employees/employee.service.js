import { createHash, randomBytes } from "node:crypto";
import { getEnv } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";
import { employeeRepository } from "./employee.repository.js";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
const expiresAt = () => new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

function invitationError(error) {
  const value = error?.message ?? "";
  const known = {
    INVITATION_NOT_FOUND: [404, "Invitation not found", "INVITATION_NOT_FOUND"],
    INVITATION_ALREADY_USED: [409, "Invitation has already been used or revoked", "INVITATION_ALREADY_USED"],
    INVITATION_EXPIRED: [410, "Invitation has expired", "INVITATION_EXPIRED"],
    INVITATION_EMAIL_MISMATCH: [403, "Sign in with the email address that was invited", "INVITATION_EMAIL_MISMATCH"],
    ACCOUNT_TYPE_CONFLICT: [409, "This account cannot accept an employee invitation", "ACCOUNT_TYPE_CONFLICT"],
    ACCOUNT_BLOCKED: [403, "This account is blocked by the platform administrator", "ACCOUNT_BLOCKED"],
  };
  const key = Object.keys(known).find((item) => value.includes(item));
  return key ? new AppError(...known[key]) : error;
}

function deliveryError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  if (message.includes("rate limit")) return new AppError(429, "Supabase email rate limit reached. Wait a few minutes and retry.", "EMAIL_RATE_LIMITED");
  if (message.includes("redirect") || message.includes("not allowed")) return new AppError(400, "The frontend URL is not allowed in Supabase Auth redirect settings.", "AUTH_REDIRECT_NOT_ALLOWED");
  if (message.includes("smtp") || message.includes("sending") || message.includes("email")) return new AppError(502, "Supabase could not deliver the invitation email. Check Auth email/SMTP settings.", "INVITATION_DELIVERY_FAILED");
  return new AppError(502, "Supabase Auth could not create or deliver the invitation.", "INVITATION_DELIVERY_FAILED", { providerStatus: error?.status ?? null, providerCode: error?.code ?? null });
}

function userAlreadyExists(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("already") && (message.includes("registered") || message.includes("exists"));
}

export function createEmployeeService({ repository = employeeRepository, env = getEnv } = {}) {
  async function deliver(email, token, frontendOrigin) {
    const config = env();
    const allowedOrigin = config.corsOrigins?.includes(frontendOrigin) ? frontendOrigin : config.frontendUrl;
    const redirect = `${allowedOrigin.replace(/\/$/, "")}/?invite=${encodeURIComponent(token)}`;
    try {
      await repository.inviteAuthUser(email, redirect);
    } catch (error) {
      if (!userAlreadyExists(error)) throw deliveryError(error);
      try { await repository.sendRecoveryEmail(email, redirect); }
      catch (recoveryError) { throw deliveryError(recoveryError); }
    }
  }
  return {
    async list(businessId) {
      const memberships = await repository.listMemberships(businessId);
      const profiles = await repository.listProfiles(memberships.map((item) => item.user_id));
      const byId = new Map(profiles.map((item) => [item.id, item]));
      return memberships.map((membership) => ({ userId: membership.user_id, role: membership.role, status: membership.status, joinedAt: membership.joined_at, email: byId.get(membership.user_id)?.email, fullName: byId.get(membership.user_id)?.full_name }));
    },
    listInvitations(businessId) { return repository.listInvitations(businessId); },
    async invite({ businessId, actorUserId, email, frontendOrigin }) {
      if (await repository.findPendingInvitation(businessId, email)) throw new AppError(409, "A pending invitation already exists", "INVITATION_EXISTS");
      const token = newToken();
      const invitation = await repository.insertInvitation({ business_id: businessId, email, invited_by: actorUserId, token_hash: hashToken(token), expires_at: expiresAt() });
      try { await deliver(email, token, frontendOrigin); } catch (error) {
        await repository.revokeInvitation(businessId, invitation.id);
        throw error;
      }
      await repository.audit({ actor_user_id: actorUserId, business_id: businessId, action: "invitation.create", metadata: { invitation_id: invitation.id, email } });
      return invitation;
    },
    async resend({ businessId, actorUserId, invitationId, frontendOrigin }) {
      const invitation = await repository.findInvitation(businessId, invitationId);
      if (!invitation || invitation.status !== "pending") throw new AppError(404, "Pending invitation not found", "INVITATION_NOT_FOUND");
      const token = newToken();
      const newHash = hashToken(token);
      const updated = await repository.rotateInvitation(businessId, invitationId, { token_hash: newHash, expires_at: expiresAt() });
      try {
        await deliver(invitation.email, token, frontendOrigin);
      } catch (error) {
        await repository.restoreInvitation(businessId, invitationId, newHash, {
          token_hash: invitation.token_hash,
          expires_at: invitation.expires_at,
        });
        throw error;
      }
      await repository.audit({ actor_user_id: actorUserId, business_id: businessId, action: "invitation.resend", metadata: { invitation_id: invitationId } });
      return updated;
    },
    async revoke({ businessId, actorUserId, invitationId }) {
      if (!await repository.revokeInvitation(businessId, invitationId)) throw new AppError(404, "Pending invitation not found", "INVITATION_NOT_FOUND");
      await repository.audit({ actor_user_id: actorUserId, business_id: businessId, action: "invitation.revoke", metadata: { invitation_id: invitationId } });
    },
    async changeStatus({ businessId, actorUserId, userId, action }) {
      const status = { disable: "disabled", reactivate: "active", remove: "removed" }[action];
      if (!await repository.updateMembership(businessId, userId, status)) throw new AppError(404, "Employee not found", "EMPLOYEE_NOT_FOUND");
      await repository.audit({ actor_user_id: actorUserId, target_user_id: userId, business_id: businessId, action: `employee.${action}` });
      return { userId, status };
    },
    async accept({ token, userId, email }) {
      try { return await repository.accept(hashToken(token), userId, email); } catch (error) { throw invitationError(error); }
    },
  };
}

export const employeeService = createEmployeeService();
