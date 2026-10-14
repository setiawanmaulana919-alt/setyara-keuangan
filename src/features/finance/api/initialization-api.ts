import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  currentUserId,
  DEFAULT_CATEGORIES,
  id,
  now,
} from "@/features/finance/api/shared";

export async function ensureFinanceDefaults(): Promise<void> {
  const client = getSupabaseBrowserClient();
  const userId = await currentUserId();
  const [
    { count: accountCount, error: accountError },
    { error: categoryError },
  ] = await Promise.all([
    client
      .from("wallets")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userId)
      .is("family_id", null),
    client
      .from("categories")
      .select("id", { head: true })
      .eq("owner_user_id", userId)
      .is("family_id", null),
  ]);
  if (accountError) throw accountError;
  if (categoryError) throw categoryError;
  const accountsTotal = accountCount ?? 0;
  if (accountsTotal === 0) {
    const { error } = await client.from("wallets").insert({
      id: id(),
      owner_user_id: userId,
      name: "Tunai",
      account_type: "cash",
      opening_balance: 0,
      opening_balance_date: now().slice(0, 10),
    });
    if (error) throw error;
  }
  const { data: existingCategories, error: existingCategoryError } =
    await client
      .from("categories")
      .select("id, name, category_type, is_archived")
      .eq("owner_user_id", userId)
      .is("family_id", null);
  if (existingCategoryError) throw existingCategoryError;

  const existingByKey = new Map(
    (existingCategories ?? []).map((category) => [
      `${category.category_type}:${category.name.trim().toLowerCase()}`,
      category,
    ]),
  );
  for (const category of DEFAULT_CATEGORIES) {
    const key = `${category.category_type}:${category.name.toLowerCase()}`;
    const existing = existingByKey.get(key);
    if (existing) {
      if (existing.is_archived) {
        const { error } = await client
          .from("categories")
          .update({ is_archived: false })
          .eq("id", existing.id);
        if (error) throw error;
      }
      continue;
    }
    const { error } = await client.from("categories").insert({
      id: id(),
      owner_user_id: userId,
      ...category,
    });
    if (error?.code === "23505") {
      const { data: categoriesAfterConflict, error: lookupError } = await client
        .from("categories")
        .select("id, name, category_type, is_archived")
        .eq("owner_user_id", userId)
        .is("family_id", null);
      if (lookupError) throw lookupError;
      const matchingCategory = (categoriesAfterConflict ?? []).find(
        (existingCategory) =>
          existingCategory.category_type === category.category_type &&
          existingCategory.name.trim().toLowerCase() ===
            category.name.toLowerCase(),
      );
      if (!matchingCategory) throw error;
      if (matchingCategory.is_archived) {
        const { error: restoreError } = await client
          .from("categories")
          .update({ is_archived: false })
          .eq("id", matchingCategory.id);
        if (restoreError) throw restoreError;
      }
    } else if (error) {
      throw error;
    }
  }
  const { error: monthlyFeeError } = await client.rpc(
    "apply_monthly_wallet_fees",
  );
  if (monthlyFeeError) throw monthlyFeeError;
}
