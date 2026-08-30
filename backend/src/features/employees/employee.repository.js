import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { getSupabaseDataClient } from "../../middleware/requestContext.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

async function rows(query) { const { data, error } = await query; throwDatabaseError(error); return data ?? []; }

export const employeeRepository = {
  listMemberships(businessId) { return rows(getSupabaseDataClient().from("business_members").select("user_id,role,status,joined_at").eq("business_id", businessId).eq("role", "employee").neq("status", "removed").order("joined_at", { ascending: false })); },
  listProfiles(ids) { return ids.length ? rows(getSupabaseDataClient().from("profiles").select("id,email,full_name,account_status").in("id", ids)) : []; },
  listInvitations(businessId) { return rows(getSupabaseDataClient().from("employee_invitations").select("id,email,status,expires_at,created_at,updated_at").eq("business_id", businessId).order("created_at", { ascending: false })); },
  async findPendingInvitation(businessId, email) { const { data, error } = await getSupabaseDataClient().from("employee_invitations").select("*").eq("business_id", businessId).eq("email", email).eq("status", "pending").maybeSingle(); throwDatabaseError(error); return data; },
  async findInvitation(businessId, invitationId) { const { data, error } = await getSupabaseDataClient().from("employee_invitations").select("*").eq("business_id", businessId).eq("id", invitationId).maybeSingle(); throwDatabaseError(error); return data; },
  async insertInvitation(values) { const { data, error } = await getSupabaseAdmin().from("employee_invitations").insert(values).select("id,email,status,expires_at,created_at").single(); throwDatabaseError(error); return data; },
  async rotateInvitation(businessId, invitationId, values) { const { data, error } = await getSupabaseAdmin().from("employee_invitations").update(values).eq("business_id", businessId).eq("id", invitationId).eq("status", "pending").select("id,email,status,expires_at,created_at").single(); throwDatabaseError(error); return data; },
  async restoreInvitation(businessId, invitationId, expectedHash, values) { const { error } = await getSupabaseAdmin().from("employee_invitations").update(values).eq("business_id", businessId).eq("id", invitationId).eq("status", "pending").eq("token_hash", expectedHash); throwDatabaseError(error); },
  async revokeInvitation(businessId, invitationId) { const { data, error } = await getSupabaseAdmin().from("employee_invitations").update({ status: "revoked" }).eq("business_id", businessId).eq("id", invitationId).eq("status", "pending").select("id").maybeSingle(); throwDatabaseError(error); return data; },
  async updateMembership(businessId, userId, status) { const { data, error } = await getSupabaseAdmin().from("business_members").update({ status }).eq("business_id", businessId).eq("user_id", userId).eq("role", "employee").select("user_id,status").maybeSingle(); throwDatabaseError(error); return data; },
  async accept(tokenHash, userId, email) { const { data, error } = await getSupabaseAdmin().rpc("accept_employee_invitation", { p_token_hash: tokenHash, p_user_id: userId, p_email: email }); if (error) throw error; return data?.[0]; },
  async inviteAuthUser(email, redirectTo) { const { data, error } = await getSupabaseAdmin().auth.admin.inviteUserByEmail(email, { redirectTo, data: { registration_type: "employee" } }); if (error) throw error; return data; },
  async sendRecoveryEmail(email, redirectTo) { const { data, error } = await getSupabaseAdmin().auth.resetPasswordForEmail(email, { redirectTo }); if (error) throw error; return data; },
  async audit(values) { const { error } = await getSupabaseAdmin().from("admin_audit_logs").insert(values); throwDatabaseError(error); },
};
