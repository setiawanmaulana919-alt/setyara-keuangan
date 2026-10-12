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
    const defaults = [
      ["Pokok", "income"],
      ["Sampingan", "income"],
      ["Kebutuhan", "expense"],
      ["Tambahan", "expense"],
      ["Darurat", "expense"],
      ["Lainnya", "expense"],
    ].map(([name, category_type]) => ({
      id: id(),
      owner_user_id: userId,
      name,
      category_type,
    }));
    const { error } = await client.from("categories").insert(defaults);
    if (error) throw error;
  }
}
