import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

async function rows(query) {
  const { data, error } = await query;
  throwDatabaseError(error);
  return data ?? [];
}

export const platformRepository = {
  listOwnerProfiles() {
    return rows(getSupabaseAdmin().from("profiles").select("id,email,full_name,account_status,created_at").eq("account_type", "owner").neq("account_status", "deleted").order("created_at", { ascending: false }));
  },
  listManagedProfiles() {
    return rows(getSupabaseAdmin().from("profiles").select("id,email,full_name,account_type,account_status,created_at").in("account_type", ["owner", "employee"]).neq("account_status", "deleted").order("created_at", { ascending: false }));
  },
  listOwnerMemberships(userIds) {
    if (!userIds.length) return [];
    return rows(getSupabaseAdmin().from("business_members").select("user_id,business_id,status,role").eq("role", "owner").in("user_id", userIds));
  },
  listMemberships(userIds) {
    if (!userIds.length) return [];
    return rows(getSupabaseAdmin().from("business_members").select("user_id,business_id,status,role").in("user_id", userIds).neq("status", "removed"));
  },
  listBusinesses(ids) {
    if (!ids.length) return [];
    return rows(getSupabaseAdmin().from("businesses").select("id,name,timezone,status,created_at").in("id", ids));
  },
  async findProfile(userId) {
    const { data, error } = await getSupabaseAdmin().from("profiles").select("*").eq("id", userId).maybeSingle();
    throwDatabaseError(error);
    return data;
  },
  async findOwnerMembership(userId) {
    const { data, error } = await getSupabaseAdmin().from("business_members").select("user_id,business_id,role,status").eq("user_id", userId).eq("role", "owner").maybeSingle();
    throwDatabaseError(error);
    return data;
  },
  async findMembership(userId) {
    const { data, error } = await getSupabaseAdmin().from("business_members").select("user_id,business_id,role,status").eq("user_id", userId).neq("status", "removed").limit(1).maybeSingle();
    throwDatabaseError(error);
    return data;
  },
  async updateProfile(userId, values) {
    const { data, error } = await getSupabaseAdmin().from("profiles").update(values).eq("id", userId).select("*").single();
    throwDatabaseError(error);
    return data;
  },
  async updateBusiness(businessId, values) {
    const { data, error } = await getSupabaseAdmin().from("businesses").update(values).eq("id", businessId).select("*").single();
    throwDatabaseError(error);
    return data;
  },
  async updateMembership(userId, businessId, values) {
    const { data, error } = await getSupabaseAdmin().from("business_members").update(values).eq("user_id", userId).eq("business_id", businessId).select("*").single();
    throwDatabaseError(error);
    return data;
  },
  async audit(values) {
    const { error } = await getSupabaseAdmin().from("admin_audit_logs").insert(values);
    throwDatabaseError(error);
  },
  listAuditLogs(limit = 100) {
    return rows(getSupabaseAdmin().from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(limit));
  },
};
