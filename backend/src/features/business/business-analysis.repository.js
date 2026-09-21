import { getSupabaseAdmin } from "../../config/supabaseAdmin.js";
import { getSupabaseDataClient } from "../../middleware/requestContext.js";
import { throwDatabaseError } from "../../shared/utils/database.js";

const expenseFields = "id, business_id, name, category, amount, currency, exchange_rate_to_usd, amount_usd, recurrence, occurrence_date, start_date, end_date, include_in_profit, notes, valid_from, valid_to, supersedes_expense_id, created_by, created_at, updated_at";
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
    validFrom: row.valid_from ?? row.start_date,
    validTo: row.valid_to ?? null,
    supersedesExpenseId: row.supersedes_expense_id ?? null,
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

async function allExpenseRows(businessId, history) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = getSupabaseDataClient().from("business_expenses").select(expenseFields).eq("business_id", businessId);
    query = applyExpenseVersionFilter(query, history);
    const { data, error } = await query.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    throwDatabaseError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map(mapExpense);
}

export function applyExpenseVersionFilter(query, history) {
  return history ? query.not("valid_to", "is", null) : query.is("valid_to", null);
}

async function allTargetRows(businessId) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getSupabaseDataClient().from("business_targets").select(targetFields)
      .eq("business_id", businessId).order("effective_from", { ascending: false })
      .order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    throwDatabaseError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map(mapTarget);
}

async function pagedExpenseRange(businessId, startDate, endDateExclusive, recurrence) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = getSupabaseDataClient().from("business_expenses").select(expenseFields)
      .eq("business_id", businessId)
      .lt("valid_from", endDateExclusive)
      .or(`valid_to.is.null,valid_to.gt.${startDate}`);
    if (recurrence === "one_time") {
      query = query.eq("recurrence", "one_time")
        .gte("occurrence_date", startDate).lt("occurrence_date", endDateExclusive);
    } else {
      query = query.neq("recurrence", "one_time")
        .lt("start_date", endDateExclusive)
        .or(`end_date.is.null,end_date.gte.${startDate}`);
    }
    const { data, error } = await query.order("valid_from", { ascending: true })
      .order("id", { ascending: true }).range(offset, offset + pageSize - 1);
    throwDatabaseError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export const businessAnalysisRepository = {
  async listExpensePage(businessId, { page = 1, pageSize = 50, history = false } = {}) {
    const offset = (page - 1) * pageSize;
    let query = getSupabaseDataClient()
      .from("business_expenses")
      .select(expenseFields, { count: "exact" })
      .eq("business_id", businessId);
    query = applyExpenseVersionFilter(query, history);
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    throwDatabaseError(error);
    const total = count ?? 0;
    let supersededIds = new Set();
    if (history && data?.length) {
      const { data: replacements, error: replacementError } = await getSupabaseDataClient()
        .from("business_expenses")
        .select("supersedes_expense_id")
        .eq("business_id", businessId)
        .in("supersedes_expense_id", data.map((row) => row.id));
      throwDatabaseError(replacementError);
      supersededIds = new Set((replacements ?? []).map((row) => row.supersedes_expense_id));
    }
    const items = (data ?? []).map((row) => ({
      ...mapExpense(row),
      ...(history ? { historyStatus: supersededIds.has(row.id) ? "changed" : "inactive" } : {}),
    }));
    return { items, total, page, pageSize, hasMore: offset + items.length < total };
  },

  async listExpenses(businessId) {
    return allExpenseRows(businessId, false);
  },

  async listExpenseHistory(businessId) {
    return allExpenseRows(businessId, true);
  },

  async listExpensesForRange(businessId, { startDate, endDateExclusive }) {
    const [oneTime, recurring] = await Promise.all([
      pagedExpenseRange(businessId, startDate, endDateExclusive, "one_time"),
      pagedExpenseRange(businessId, startDate, endDateExclusive, "recurring"),
    ]);
    return [...oneTime, ...recurring].map(mapExpense);
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

  async deleteExpense(businessId, actorUserId, expenseId, effectiveDate) {
    const { data, error } = await getSupabaseAdmin().rpc("delete_business_expense_atomic", {
      p_business_id: businessId,
      p_actor_user_id: actorUserId,
      p_expense_id: expenseId,
      p_effective_date: effectiveDate,
    });
    throwDatabaseError(error);
    return data?.[0]?.outcome ?? "failed";
  },

  async listTargets(businessId) {
    return allTargetRows(businessId);
  },

  async listTargetsForRange(businessId, { startDate, endDateExclusive }) {
    const client = getSupabaseDataClient();
    const [applicable, preceding] = await Promise.all([
      client.from("business_targets").select(targetFields)
        .eq("business_id", businessId)
        .gte("effective_from", startDate).lt("effective_from", endDateExclusive)
        .order("effective_from", { ascending: true }).order("created_at", { ascending: true }),
      client.from("business_targets").select(targetFields)
        .eq("business_id", businessId).lt("effective_from", startDate)
        .order("effective_from", { ascending: false }).order("created_at", { ascending: false }).limit(1),
    ]);
    throwDatabaseError(applicable.error);
    throwDatabaseError(preceding.error);
    return [...(preceding.data ?? []), ...(applicable.data ?? [])].map(mapTarget);
  },

  async listTargetPage(businessId, { page = 1, pageSize = 50 } = {}) {
    const offset = (page - 1) * pageSize;
    const { data, error, count } = await getSupabaseDataClient()
      .from("business_targets")
      .select(targetFields, { count: "exact" })
      .eq("business_id", businessId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    throwDatabaseError(error);
    const total = count ?? 0;
    return { items: (data ?? []).map(mapTarget), total, page, pageSize, hasMore: offset + (data?.length ?? 0) < total };
  },

  async findTarget(businessId, targetId) {
    const { data, error } = await getSupabaseDataClient()
      .from("business_targets")
      .select(targetFields)
      .eq("business_id", businessId)
      .eq("id", targetId)
      .maybeSingle();
    throwDatabaseError(error);
    return mapTarget(data);
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
