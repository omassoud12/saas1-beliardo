import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { getSupabaseDataClient } from "../../middleware/requestContext.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

const expenseFields = "id, business_id, name, category, amount, currency, exchange_rate_to_usd, amount_usd, recurrence, occurrence_date, start_date, end_date, include_in_profit, notes, created_by, created_at, updated_at";
const targetFields = "id, business_id, monthly_revenue_target, monthly_profit_target, minimum_profit_margin, maximum_monthly_costs, currency, exchange_rate_to_usd, monthly_revenue_target_usd, monthly_profit_target_usd, maximum_monthly_costs_usd, effective_from, created_by, created_at, updated_at";

export function mapExpense(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    category: row.category,
    amount: Number(row.amount),
    currency: row.currency,
    exchangeRateToUsd: Number(row.exchange_rate_to_usd),
    amountUsd: Number(row.amount_usd),
    recurrence: row.recurrence,
    occurrenceDate: row.occurrence_date,
    startDate: row.start_date,
    endDate: row.end_date,
    includeInProfit: Boolean(row.include_in_profit),
    notes: row.notes ?? "",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTarget(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessId: row.business_id,
    monthlyRevenueTarget: Number(row.monthly_revenue_target),
    monthlyProfitTarget: Number(row.monthly_profit_target),
    minimumProfitMargin: Number(row.minimum_profit_margin),
    maximumMonthlyCosts: row.maximum_monthly_costs === null ? null : Number(row.maximum_monthly_costs),
    currency: row.currency,
    exchangeRateToUsd: Number(row.exchange_rate_to_usd),
    monthlyRevenueTargetUsd: Number(row.monthly_revenue_target_usd),
    monthlyProfitTargetUsd: Number(row.monthly_profit_target_usd),
    maximumMonthlyCostsUsd: row.maximum_monthly_costs_usd === null ? null : Number(row.maximum_monthly_costs_usd),
    effectiveFrom: row.effective_from,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rpcResult(data) {
  const value = data?.[0] ?? {};
  return { outcome: value.outcome ?? "failed", record: value.record_data ?? null };
}

export const businessAnalysisRepository = {
  async listExpenses(businessId) {
    const { data, error } = await getSupabaseDataClient()
      .from("business_expenses")
      .select(expenseFields)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(500);
    throwDatabaseError(error);
    return (data ?? []).map(mapExpense);
  },

  async saveExpense(businessId, actorUserId, expenseId, values) {
    const { data, error } = await getSupabaseAdmin().rpc("save_business_expense_atomic", {
      p_business_id: businessId,
      p_actor_user_id: actorUserId,
      p_expense_id: expenseId,
      p_payload: values,
    });
    throwDatabaseError(error);
    const result = rpcResult(data);
    return { ...result, expense: mapExpense(result.record) };
  },

  async deleteExpense(businessId, actorUserId, expenseId) {
    const { data, error } = await getSupabaseAdmin().rpc("delete_business_expense_atomic", {
      p_business_id: businessId,
      p_actor_user_id: actorUserId,
      p_expense_id: expenseId,
    });
    throwDatabaseError(error);
    return data?.[0]?.outcome ?? "failed";
  },

  async listTargets(businessId) {
    const { data, error } = await getSupabaseDataClient()
      .from("business_targets")
      .select(targetFields)
      .eq("business_id", businessId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(250);
    throwDatabaseError(error);
    return (data ?? []).map(mapTarget);
  },

  async saveTarget(businessId, actorUserId, targetId, values) {
    const { data, error } = await getSupabaseAdmin().rpc("save_business_target_atomic", {
      p_business_id: businessId,
      p_actor_user_id: actorUserId,
      p_target_id: targetId,
      p_payload: values,
    });
    throwDatabaseError(error);
    const result = rpcResult(data);
    return { ...result, target: mapTarget(result.record) };
  },

  async deleteTarget(businessId, actorUserId, targetId) {
    const { data, error } = await getSupabaseAdmin().rpc("delete_business_target_atomic", {
      p_business_id: businessId,
      p_actor_user_id: actorUserId,
      p_target_id: targetId,
    });
    throwDatabaseError(error);
    return data?.[0]?.outcome ?? "failed";
  },
};
