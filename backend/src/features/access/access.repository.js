import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

export const accessRepository = {
  async markPasswordConfigured(userId) {
    const { data, error } = await getSupabaseAdmin()
      .from("profiles")
      .update({ requires_password_setup: false })
      .eq("id", userId)
      .select("id, requires_password_setup")
      .single();
    throwDatabaseError(error);
    return data;
  },
};
