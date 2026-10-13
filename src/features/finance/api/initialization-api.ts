import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { currentUserId, id, now } from "@/features/finance/api/shared";

export async function ensureFinanceDefaults(): Promise<void> {
  const client = getSupabaseBrowserClient();
  const userId = await currentUserId();
  const [
    { count: accountCount, error: accountError },
    { count: categoryCount, error: categoryError },
  ] = await Promise.all([
    client
      .from("wallets")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userId)
      .is("family_id", null),
    client
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", userId)
      .is("family_id", null),
  ]);
  if (accountError) throw accountError;
  if (categoryError) throw categoryError;
  const accountsTotal = accountCount ?? 0;
  const categoriesTotal = categoryCount ?? 0;
  if (accountsTotal > 0 && categoriesTotal > 0) return;

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
  if (categoriesTotal === 0) {
    const defaults: Array<{
      name: string;
      category_type: "income" | "expense";
    }> = [
      { name: "Pokok", category_type: "income" },
      { name: "Sampingan", category_type: "income" },
      { name: "Kebutuhan", category_type: "expense" },
      { name: "Tambahan", category_type: "expense" },
      { name: "Darurat", category_type: "expense" },
      { name: "Lainnya", category_type: "expense" },
    ];
    const existingKeys = new Set<string>();
    const { data: existingCategories, error: existingCategoryError } =
      await client
        .from("categories")
        .select("name, category_type")
        .eq("owner_user_id", userId)
        .is("family_id", null);
    if (existingCategoryError) throw existingCategoryError;
    for (const category of existingCategories ?? []) {
      existingKeys.add(
        `${category.category_type}:${category.name.trim().toLowerCase()}`,
      );
    }

    for (const category of defaults) {
      const key = `${category.category_type}:${category.name.toLowerCase()}`;
      if (existingKeys.has(key)) continue;
      const { error } = await client.from("categories").insert({
        id: id(),
        owner_user_id: userId,
        ...category,
      });
      if (!error) {
        existingKeys.add(key);
        continue;
      }
      if (error.code !== "23505") throw error;

      const { data: categoriesAfterConflict, error: lookupError } = await client
        .from("categories")
        .select("name, category_type")
        .eq("owner_user_id", userId)
        .is("family_id", null);
      if (lookupError) throw lookupError;
      const categoryExists = (categoriesAfterConflict ?? []).some(
        (existing) =>
          existing.category_type === category.category_type &&
          existing.name.trim().toLowerCase() === category.name.toLowerCase(),
      );
      if (!categoryExists) throw error;
      existingKeys.add(key);
    }
  }
}
