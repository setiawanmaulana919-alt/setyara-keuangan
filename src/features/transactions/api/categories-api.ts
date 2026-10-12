import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Category, TransactionType } from "@/types/data-model";
import {
  CATEGORY_COLUMNS,
  categoryFromRow,
  currentUserId,
  id,
} from "@/features/finance/api/shared";

export async function listCategories(
  transactionType?: TransactionType,
): Promise<Category[]> {
  let query = getSupabaseBrowserClient()
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .eq("is_archived", false)
    .order("created_at");
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

export async function createCategory(input: {
  name: string;
  transactionType: TransactionType;
}): Promise<Category> {
  const userId = await currentUserId();
  const { data, error } = await getSupabaseBrowserClient()
    .from("categories")
    .insert({
      id: id(),
      owner_user_id: userId,
      name: input.name.trim(),
      category_type: input.transactionType,
    })
    .select(CATEGORY_COLUMNS)
    .single();
  if (error) throw error;
  return categoryFromRow(data, 0);
}
