import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Category, TransactionType } from "@/types/data-model";
import {
  CATEGORY_COLUMNS,
  categoryFromRow,
  DEFAULT_CATEGORIES,
} from "@/features/finance/api/shared";

export const GOAL_CATEGORY_NAME = "Target keuangan";
export const OTHER_CATEGORY_NAME = "Lainnya";

export function isGoalCategoryName(name: string): boolean {
  return (
    name.trim().toLocaleLowerCase("id-ID") ===
    GOAL_CATEGORY_NAME.toLocaleLowerCase("id-ID")
  );
}

export function isOtherCategoryName(name: string): boolean {
  return (
    name.trim().toLocaleLowerCase("id-ID") ===
    OTHER_CATEGORY_NAME.toLocaleLowerCase("id-ID")
  );
}

export function isDefaultCategory(
  name: string,
  transactionType: TransactionType,
): boolean {
  return DEFAULT_CATEGORIES.some(
    (category) =>
      category.category_type === transactionType &&
      category.name.toLocaleLowerCase("id-ID") ===
        name.trim().toLocaleLowerCase("id-ID"),
  );
}

export async function listCategories(
  transactionType?: TransactionType,
  includeArchived = false,
): Promise<Category[]> {
  let query = getSupabaseBrowserClient()
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .order("created_at");
  if (!includeArchived) query = query.eq("is_archived", false);
  if (transactionType) query = query.eq("category_type", transactionType);
  const { data, error } = await query;
  if (error) throw error;
  const categories = (data ?? []).map((row, index) =>
    categoryFromRow(row, index),
  );
  return transactionType
    ? categories.filter(
        (category) => category.transactionType === transactionType,
      )
    : categories;
}
