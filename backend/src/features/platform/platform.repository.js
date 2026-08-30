import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { getSupabaseDataClient } from "../../middleware/requestContext.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

async function rows(query) {
  const { data, error } = await query;
  throwDatabaseError(error);
  return data ?? [];
}

export const platformRepository = {
  async transitionUser(actorUserId, userId, action) {
    const { data, error } = await getSupabaseAdmin().rpc("transition_managed_user_atomic", {
      p_actor_user_id: actorUserId,
      p_target_user_id: userId,
      p_action: action,
    });
    throwDatabaseError(error);
    return data?.[0] ?? { outcome: "not_found", account_status: null, business_id: null };
  },
  async updateUserName(actorUserId, userId, fullName) {
    const { data, error } = await getSupabaseAdmin().rpc("update_managed_user_name_atomic", {
      p_actor_user_id: actorUserId,
      p_target_user_id: userId,
      p_full_name: fullName,
    });
    throwDatabaseError(error);
    return data?.[0] ?? { outcome: "not_found", profile_record: null };
  },
  async setAuthBan(userId, banned) {
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(userId, {
      ban_duration: banned ? "876000h" : "none",
    });
    throwDatabaseError(error);
  },
  listOwnerProfiles() {
    return rows(getSupabaseDataClient().from("profiles").select("id,email,full_name,account_status,created_at").eq("account_type", "owner").neq("account_status", "deleted").order("created_at", { ascending: false }));
  },
  listManagedProfiles() {
    return rows(getSupabaseDataClient().from("profiles").select("id,email,full_name,account_type,account_status,created_at").in("account_type", ["owner", "employee"]).neq("account_status", "deleted").order("created_at", { ascending: false }));
  },
  listOwnerMemberships(userIds) {
    if (!userIds.length) return [];
    return rows(getSupabaseDataClient().from("business_members").select("user_id,business_id,status,role").eq("role", "owner").in("user_id", userIds));
  },
  listMemberships(userIds) {
    if (!userIds.length) return [];
    return rows(getSupabaseDataClient().from("business_members").select("user_id,business_id,status,role").in("user_id", userIds).neq("status", "removed"));
  },
  listBusinesses(ids) {
    if (!ids.length) return [];
    return rows(getSupabaseDataClient().from("businesses").select("id,name,timezone,status,created_at").in("id", ids));
  },
  listAuditLogs(limit = 100) {
    return rows(getSupabaseDataClient().from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(limit));
  },
};
