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
  const client = getSupabaseBrowserClient();
  const name = input.name.trim();
  const { data: existingCategories, error: lookupError } = await client
    .from("categories")
    .select("name")
    .eq("owner_user_id", userId)
    .is("family_id", null)
    .eq("category_type", input.transactionType);
  if (lookupError) throw lookupError;
  if (
    existingCategories?.some(
      (category) => category.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error("Kategori dengan nama dan jenis transaksi ini sudah ada.");
  }

  const { data, error } = await client
    .from("categories")
    .insert({
      id: id(),
      owner_user_id: userId,
      name,
      category_type: input.transactionType,
    })
    .select(CATEGORY_COLUMNS)
    .single();
  if (error?.code === "23505") {
    throw new Error("Kategori dengan nama dan jenis transaksi ini sudah ada.");
  }
  if (error) throw error;
  return categoryFromRow(data, 0);
}
