import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { throwDatabaseError } from "../../shared/utils/database.js";
import { getEnv } from "../../config/env.js";
import { AppError } from "../../shared/errors/AppError.js";

export const accessRepository = {
  async updateAuthPassword(accessToken, password) {
    const env = getEnv();
    if (!env.supabaseAnonKey) throw new AppError(503, "Password service is not configured", "AUTH_CONFIGURATION_ERROR");
    const response = await fetch(new URL("auth/v1/user", `${env.supabaseUrl.replace(/\/$/, "")}/`), {
      method: "PUT",
      headers: {
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      if (response.status === 401) throw new AppError(401, "Authentication has expired", "UNAUTHORIZED");
      throw new AppError(400, "Password does not meet the authentication policy", "PASSWORD_UPDATE_REJECTED");
    }
  },

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
