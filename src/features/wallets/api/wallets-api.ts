import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Account } from "@/types/data-model";
import {
  now,
  id,
  ACCOUNT_COLUMNS,
  assertDate,
  currentUserId,
  accountFromRow,
} from "@/features/finance/api/shared";
import type { AccountBalance } from "@/features/wallets/types";

export function accountBalanceMap(rows: unknown): Map<string, number> {
  if (!Array.isArray(rows)) {
    throw new Error("Respons saldo akun dari Supabase tidak valid.");
  }
  const balances = new Map<string, number>();
  for (const row of rows) {
    if (
      typeof row !== "object" ||
      row === null ||
      !("account_id" in row) ||
      !("balance" in row) ||
      typeof row.account_id !== "string" ||
      (typeof row.balance !== "number" && typeof row.balance !== "string")
    ) {
      throw new Error("Respons saldo akun dari Supabase tidak valid.");
    }
    const balance = Number(row.balance);
    if (!Number.isFinite(balance)) {
      throw new Error("Supabase mengembalikan saldo akun yang tidak valid.");
    }
    balances.set(row.account_id, balance);
  }
  return balances;
}

export async function listAccountBalances(): Promise<AccountBalance[]> {
  const client = getSupabaseBrowserClient();
  const [accounts, { data, error }] = await Promise.all([
    listAccounts(),
    client.rpc("get_account_balances"),
  ]);
  if (error) throw error;
  const balances = accountBalanceMap(data);

  return accounts.map((account) => {
    const balance = balances.get(account.id);
    if (balance === undefined) {
      throw new Error(`Saldo akun ${account.id} tidak ditemukan.`);
    }
    return { account, balance };
  });
}

export async function assertAccountCanSpend(
  accountId: string,
  amount: number,
  balanceAdjustment = 0,
): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error("Jumlah pengeluaran harus lebih besar dari nol.");
  }
  const client = getSupabaseBrowserClient();
  const [
    { data: account, error: accountError },
    { data: balances, error: balanceError },
  ] = await Promise.all([
    client.from("wallets").select("name").eq("id", accountId).maybeSingle(),
    client.rpc("get_account_balances"),
  ]);
  if (accountError) throw accountError;
  if (balanceError) throw balanceError;
  if (!account) throw new Error("Akun sumber dana tidak ditemukan.");
  const balance = accountBalanceMap(balances).get(accountId);
  if (balance === undefined) {
    throw new Error("Saldo akun tidak dapat diperiksa.");
  }
  const available = balance + balanceAdjustment;
  if (available - amount < 0 && available - amount < balance) {
    throw new Error(
      `Saldo akun "${account.name}" tidak cukup. Gunakan akun lain atau kurangi nominal.`,
    );
  }
}

export function formatAccountSpendError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (!message.toLocaleLowerCase("id-ID").includes("saldo akun")) {
    return message || "Data gagal disimpan.";
  }

  const accountName = message.match(
    /Saldo akun ["“](.+?)["”] tidak cukup/i,
  )?.[1];
  return accountName
    ? `Saldo akun "${accountName}" tidak cukup. Gunakan akun lain atau kurangi nominal.`
    : "Saldo akun tidak cukup. Gunakan akun lain atau kurangi nominal.";
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("wallets")
    .select(ACCOUNT_COLUMNS)
    .eq("is_archived", false)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => accountFromRow(row));
}

export async function createAccount(input: {
  name: string;
  accountType: Account["accountType"];
  openingBalance: number;
  openingBalanceDate: string;
  investmentType?: Account["investmentType"];
  assetSymbol?: string;
  assetQuantity?: number;
  assetUnit?: Account["assetUnit"];
  purchasePrice?: number;
  marketPrice?: number;
  marketUpdatedAt?: string;
}): Promise<Account> {
  if (!Number.isSafeInteger(input.openingBalance) || input.openingBalance < 0) {
    throw new Error("openingBalance harus berupa bilangan bulat non-negatif.");
  }
  assertDate(input.openingBalanceDate, "openingBalanceDate");
  const userId = await currentUserId();
  const row = {
    id: id(),
    owner_user_id: userId,
    name: input.name.trim(),
    account_type:
      input.accountType === "eWallet" ? "e_wallet" : input.accountType,
    opening_balance: input.openingBalance,
    opening_balance_date: input.openingBalanceDate,
    investment_type: input.investmentType ?? null,
    asset_symbol: input.assetSymbol?.trim().toUpperCase() ?? null,
    asset_quantity: input.assetQuantity ?? null,
    asset_unit: input.assetUnit ?? null,
    purchase_price: input.purchasePrice ?? null,
    market_price: input.marketPrice ?? null,
    market_updated_at: input.marketUpdatedAt ?? null,
  };
  const { data, error } = await getSupabaseBrowserClient()
    .from("wallets")
    .insert(row)
    .select(ACCOUNT_COLUMNS)
    .single();
  if (error) throw error;
  return accountFromRow(data);
}

export async function updateAccount(
  accountId: string,
  input: {
    name: string;
    accountType: Account["accountType"];
    openingBalance: number;
    openingBalanceDate: string;
    investmentType?: Account["investmentType"];
    assetSymbol?: string;
    assetQuantity?: number;
    assetUnit?: Account["assetUnit"];
    purchasePrice?: number;
    marketPrice?: number;
    marketUpdatedAt?: string;
  },
): Promise<Account> {
  assertDate(input.openingBalanceDate, "openingBalanceDate");
  const { data, error } = await getSupabaseBrowserClient()
    .from("wallets")
    .update({
      name: input.name.trim(),
      account_type:
        input.accountType === "eWallet" ? "e_wallet" : input.accountType,
      opening_balance: input.openingBalance,
      opening_balance_date: input.openingBalanceDate,
      investment_type: input.investmentType ?? null,
      asset_symbol: input.assetSymbol?.trim().toUpperCase() ?? null,
      asset_quantity: input.assetQuantity ?? null,
      asset_unit: input.assetUnit ?? null,
      purchase_price: input.purchasePrice ?? null,
      market_price: input.marketPrice ?? null,
      market_updated_at: input.marketUpdatedAt ?? null,
      updated_at: now(),
    })
    .eq("id", accountId)
    .select(ACCOUNT_COLUMNS)
    .single();
  if (error) throw error;
  return accountFromRow(data);
}

export async function updateAccountMarketPrice(
  accountId: string,
  marketPrice: number,
  marketUpdatedAt: string,
): Promise<Account> {
  if (!Number.isFinite(marketPrice) || marketPrice < 0) {
    throw new Error("Harga pasar tidak valid.");
  }
  const { data, error } = await getSupabaseBrowserClient()
    .from("wallets")
    .update({
      market_price: Math.round(marketPrice),
      market_updated_at: marketUpdatedAt,
      updated_at: now(),
    })
    .eq("id", accountId)
    .select(ACCOUNT_COLUMNS)
    .single();
  if (error) throw error;
  return accountFromRow(data);
}

export async function deleteAccount(accountId: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  const [transactionResult, transferResult, loanResult, repaymentResult] =
    await Promise.all([
      client
        .from("financial_transactions")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId),
      client
        .from("wallet_transfers")
        .select("id", { count: "exact", head: true })
        .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`),
      client
        .from("loans")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId),
      client
        .from("loan_payments")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId),
    ]);
  if (transactionResult.error) throw transactionResult.error;
  if (transferResult.error) throw transferResult.error;
  if (loanResult.error) throw loanResult.error;
  if (repaymentResult.error) throw repaymentResult.error;
  if (
    (transactionResult.count ?? 0) > 0 ||
    (transferResult.count ?? 0) > 0 ||
    (loanResult.count ?? 0) > 0 ||
    (repaymentResult.count ?? 0) > 0
  ) {
    throw new Error(
      "Dompet tidak dapat dihapus karena masih memiliki transaksi, transfer, atau catatan pinjaman.",
    );
  }

  const { data, error } = await client
    .from("wallets")
    .delete()
    .eq("id", accountId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Dompet tidak ditemukan atau tidak dapat dihapus.");
  }
}
