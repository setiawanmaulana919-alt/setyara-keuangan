import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  ACCOUNT_COLUMNS,
  TRANSACTION_COLUMNS,
  CATEGORY_COLUMNS,
  assertDateRange,
  assertDate,
  accountFromRow,
  categoryFromRow,
  transactionFromRow,
} from "@/features/finance/api/shared";
import type { DashboardData } from "@/features/dashboard/types";
import type { AccountBalance } from "@/features/wallets/types";
import { listAccounts } from "@/features/wallets/api/wallets-api";
import { ensureFinanceDefaults } from "@/features/finance/api/initialization-api";
import { getTransactionPeriodTotals } from "@/features/transactions/api/transactions-api";
import { listGoalProgress } from "@/features/goals/api/goals-api";

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const client = getSupabaseBrowserClient();
  const [accounts, balanceResult] = await Promise.all([
    listAccounts(),
    client.rpc("get_account_balances"),
  ]);
  if (balanceResult.error) throw balanceResult.error;
  const balancesByAccountId = accountBalanceMap(balanceResult.data);
  return accounts.map((account) => {
    const balance = balancesByAccountId.get(account.id);
    if (balance === undefined) {
      throw new Error(`Saldo akun ${account.id} tidak ditemukan.`);
    }
    return { account, balance };
  });
}

function accountBalanceMap(rows: unknown): Map<string, number> {
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

export async function getDashboardData(
  from?: string,
  to?: string,
): Promise<DashboardData> {
  const client = getSupabaseBrowserClient();
  const periodTo = to ?? new Date().toISOString().slice(0, 10);
  const periodFrom = from ?? `${periodTo.slice(0, 7)}-01`;
  assertDate(periodFrom, "from");
  assertDate(periodTo, "to");
  assertDateRange(periodFrom, periodTo);
  const [
    initialAccountResult,
    initialCategoryResult,
    recentTransactionRows,
    initialBalanceResult,
    goals,
    transactionPeriodTotals,
  ] = await Promise.all([
    client
      .from("wallets")
      .select(ACCOUNT_COLUMNS)
      .eq("is_archived", false)
      .order("created_at"),
    client
      .from("categories")
      .select(CATEGORY_COLUMNS)
      .eq("is_archived", false)
      .order("created_at"),
    client
      .from("financial_transactions")
      .select(TRANSACTION_COLUMNS)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(5),
    client.rpc("get_account_balances"),
    listGoalProgress(),
    getTransactionPeriodTotals(periodFrom, periodTo, true),
  ]);
  if (recentTransactionRows.error) throw recentTransactionRows.error;
  let balanceResult = initialBalanceResult;
  let accountResult = initialAccountResult;
  let categoryResult = initialCategoryResult;
  const firstError = [accountResult.error, categoryResult.error].find(Boolean);
  if (firstError) throw firstError;
  if (balanceResult.error) throw balanceResult.error;
  if (
    (accountResult.data?.length ?? 0) === 0 ||
    (categoryResult.data?.length ?? 0) === 0
  ) {
    await ensureFinanceDefaults();
    [accountResult, categoryResult] = await Promise.all([
      client
        .from("wallets")
        .select(ACCOUNT_COLUMNS)
        .eq("is_archived", false)
        .order("created_at"),
      client
        .from("categories")
        .select(CATEGORY_COLUMNS)
        .eq("is_archived", false)
        .order("created_at"),
    ]);
    if (accountResult.error) throw accountResult.error;
    if (categoryResult.error) throw categoryResult.error;
    balanceResult = await client.rpc("get_account_balances");
    if (balanceResult.error) throw balanceResult.error;
  }

  const accounts = (accountResult.data ?? []).map((row) => accountFromRow(row));
  const categories = (categoryResult.data ?? []).map((row, index) =>
    categoryFromRow(row, index),
  );
  const transactions = (recentTransactionRows.data ?? []).map((row) =>
    transactionFromRow(row),
  );
  const balancesByAccountId = accountBalanceMap(balanceResult.data);
  const balances = accounts.map((account) => {
    const balance = balancesByAccountId.get(account.id);
    if (balance === undefined) {
      throw new Error(`Saldo akun ${account.id} tidak ditemukan.`);
    }
    return { account, balance };
  });
  const sourceBalance = balances
    .filter(
      ({ account }) =>
        !["investment", "receivable"].includes(account.accountType),
    )
    .reduce((total, item) => total + item.balance, 0);
  let income = 0;
  let expense = 0;
  const expensesByCategoryId = new Map<string, number>();
  for (const total of transactionPeriodTotals) {
    if (total.transactionType === "income") {
      income += total.amount;
    } else {
      expense += total.amount;
      if (total.categoryId) {
        expensesByCategoryId.set(
          total.categoryId,
          (expensesByCategoryId.get(total.categoryId) ?? 0) + total.amount,
        );
      }
    }
  }
  const expenseByCategory = categories
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      amount: expensesByCategoryId.get(category.id) ?? 0,
    }))
    .filter((category) => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return {
    summary: {
      balance: sourceBalance,
      income,
      expense,
      cashFlow: income - expense,
      expenseByCategory,
    },
    balances,
    goals,
    transactions,
    accounts,
    categories,
  };
}
