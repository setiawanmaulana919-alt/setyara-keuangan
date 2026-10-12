import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Budget } from "@/types/data-model";
import {
  id,
  BUDGET_COLUMNS,
  fetchAllRows,
  assertPositiveInteger,
  assertDateRange,
  assertDate,
  currentUserId,
} from "@/features/finance/api/shared";
import type { BudgetProgress } from "@/features/budgets/types";
import { listCategories } from "@/features/transactions/api/categories-api";
import { getTransactionPeriodTotals } from "@/features/transactions/api/transactions-api";

export async function createBudget(input: {
  categoryId: string;
  amountLimit: number;
  periodStart: string;
  periodEnd: string;
}): Promise<Budget> {
  const { data: category, error: categoryError } =
    await getSupabaseBrowserClient()
      .from("categories")
      .select("id, category_type")
      .eq("id", input.categoryId)
      .maybeSingle();
  if (categoryError) throw categoryError;
  if (!category || category.category_type !== "expense") {
    throw new Error("Anggaran harus memakai kategori pengeluaran yang valid.");
  }
  assertPositiveInteger(input.amountLimit, "amountLimit");
  assertDate(input.periodStart, "periodStart");
  assertDate(input.periodEnd, "periodEnd");
  assertDateRange(input.periodStart, input.periodEnd);
  const userId = await currentUserId();
  const { data, error } = await getSupabaseBrowserClient()
    .from("spending_budgets")
    .insert({
      id: id(),
      owner_user_id: userId,
      category_id: input.categoryId,
      amount_limit: input.amountLimit,
      period_start: input.periodStart,
      period_end: input.periodEnd,
    })
    .select(BUDGET_COLUMNS)
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    ownerUserId: userId,
    scopeType: "personal",
    categoryId: String(data.category_id),
    amountLimit: Number(data.amount_limit),
    periodStart: String(data.period_start),
    periodEnd: String(data.period_end),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}

export async function listBudgetProgress(): Promise<BudgetProgress[]> {
  const client = getSupabaseBrowserClient();
  const [rows, categories] = await Promise.all([
    fetchAllRows((from, to) =>
      client
        .from("spending_budgets")
        .select(BUDGET_COLUMNS)
        .order("period_start")
        .order("id")
        .range(from, to),
    ),
    listCategories(),
  ]);
  const budgets = rows.map((data) => ({
    id: String(data.id),
    ownerUserId: String(data.owner_user_id),
    scopeType: "personal" as const,
    categoryId: String(data.category_id),
    amountLimit: Number(data.amount_limit),
    periodStart: String(data.period_start),
    periodEnd: String(data.period_end),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  }));
  if (budgets.length === 0) return [];

  const from = budgets.reduce(
    (earliest, budget) =>
      budget.periodStart < earliest ? budget.periodStart : earliest,
    budgets[0].periodStart,
  );
  const to = budgets.reduce(
    (latest, budget) => (budget.periodEnd > latest ? budget.periodEnd : latest),
    budgets[0].periodEnd,
  );
  const transactionTotals = await getTransactionPeriodTotals(from, to, false);
  const totalsByCategory = new Map<
    string,
    Array<{ date: string; prefix: number }>
  >();
  for (const total of transactionTotals) {
    if (total.transactionType !== "expense" || !total.categoryId) continue;
    const entries = totalsByCategory.get(total.categoryId) ?? [];
    entries.push({
      date: total.periodStart,
      prefix: total.amount,
    });
    totalsByCategory.set(total.categoryId, entries);
  }
  const prefixByCategory = new Map(totalsByCategory);
  for (const [categoryId, entries] of prefixByCategory) {
    entries.sort((a, b) => a.date.localeCompare(b.date));
    let runningTotal = 0;
    for (const entry of entries) {
      runningTotal += entry.prefix;
      entry.prefix = runningTotal;
    }
    prefixByCategory.set(categoryId, entries);
  }
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  return budgets.map((budget) => {
    const entries = prefixByCategory.get(budget.categoryId) ?? [];
    let lower = 0;
    let upper = entries.length;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      if (entries[middle].date < budget.periodStart) lower = middle + 1;
      else upper = middle;
    }
    const firstIndex = lower;
    upper = entries.length;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      if (entries[middle].date <= budget.periodEnd) lower = middle + 1;
      else upper = middle;
    }
    const lastIndex = lower - 1;
    const actual =
      lastIndex < firstIndex
        ? 0
        : entries[lastIndex].prefix -
          (firstIndex > 0 ? entries[firstIndex - 1].prefix : 0);
    return {
      budget,
      categoryName:
        categoryNames.get(budget.categoryId) ?? "Kategori tidak dikenal",
      actual,
      remaining: budget.amountLimit - actual,
      exceeded: actual > budget.amountLimit,
    };
  });
}
