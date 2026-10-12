import { getCurrentUser } from "@/lib/supabase/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  Account,
  Category,
  FinancialTransaction,
  Transfer,
  TransactionType,
} from "@/types/data-model";

export function now(): string {
  return new Date().toISOString();
}

export function id(): string {
  return crypto.randomUUID();
}

export const QUERY_PAGE_SIZE = 1000;

export const ACCOUNT_COLUMNS =
  "id, owner_user_id, family_id, name, account_type, opening_balance, opening_balance_date, investment_type, asset_symbol, asset_quantity, asset_unit, purchase_price, market_price, market_updated_at, created_at, updated_at, is_archived";

export const TRANSACTION_COLUMNS =
  "id, owner_user_id, family_id, account_id, category_id, transaction_type, amount, transaction_date, description, created_at, updated_at";

export const TRANSFER_COLUMNS =
  "id, owner_user_id, family_id, from_account_id, to_account_id, amount, transfer_date, description, created_at, updated_at";

export const CATEGORY_COLUMNS =
  "id, owner_user_id, family_id, name, category_type, created_at, updated_at, is_archived";

export const GOAL_COLUMNS =
  "id, owner_user_id, family_id, name, target_amount, target_date, created_at, updated_at";

export const GOAL_CONTRIBUTION_COLUMNS =
  "id, goal_id, transaction_id, amount, contribution_date, created_at";

export const BUDGET_COLUMNS =
  "id, owner_user_id, category_id, amount_limit, period_start, period_end, created_at, updated_at";

export const ASSET_COLUMNS =
  "id, owner_user_id, name, asset_type, acquisition_value, created_at, updated_at";

export const ASSET_VALUATION_COLUMNS =
  "id, asset_id, valuation_date, market_value, created_at";

export async function getGoalContributionTotals(): Promise<
  Map<string, number>
> {
  const { data, error } = await getSupabaseBrowserClient().rpc(
    "get_goal_contribution_totals",
  );
  if (error) throw error;
  if (!Array.isArray(data)) {
    throw new Error("Respons total target dari Supabase tidak valid.");
  }
  const totals = new Map<string, number>();
  for (const row of data) {
    if (
      typeof row.goal_id !== "string" ||
      (typeof row.saved_amount !== "number" &&
        typeof row.saved_amount !== "string")
    ) {
      throw new Error("Respons total target dari Supabase tidak valid.");
    }
    const saved = Number(row.saved_amount);
    if (!Number.isSafeInteger(saved) || saved < 0) {
      throw new Error("Supabase mengembalikan total target yang tidak valid.");
    }
    totals.set(row.goal_id, saved);
  }
  return totals;
}

export async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  let page: T[];

  do {
    const { data, error } = await fetchPage(from, from + QUERY_PAGE_SIZE - 1);
    if (error) throw error;
    page = data ?? [];
    rows.push(...page);
    from += QUERY_PAGE_SIZE;
  } while (page.length === QUERY_PAGE_SIZE);

  return rows;
}

export function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} harus berupa bilangan bulat positif.`);
  }
}

export function assertDateRange(from: string, to: string): void {
  if (!from || !to || from > to) {
    throw new Error("Periode tanggal tidak valid.");
  }
}

export function assertDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} harus berupa tanggal ISO.`);
  }
}

export async function currentUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sesi login tidak tersedia.");
  return user.id;
}

export function accountFromRow(row: Record<string, unknown>): Account {
  return {
    id: String(row.id),
    ownerUserId:
      typeof row.owner_user_id === "string" ? row.owner_user_id : undefined,
    familyId: typeof row.family_id === "string" ? row.family_id : undefined,
    scopeType: row.family_id ? "family" : "personal",
    name: String(row.name),
    accountType:
      row.account_type === "e_wallet"
        ? "eWallet"
        : (row.account_type as Account["accountType"]),
    openingBalance: Number(row.opening_balance ?? 0),
    openingBalanceDate: String(row.opening_balance_date),
    ...(typeof row.investment_type === "string"
      ? { investmentType: row.investment_type as Account["investmentType"] }
      : {}),
    ...(typeof row.asset_symbol === "string"
      ? { assetSymbol: row.asset_symbol }
      : {}),
    ...(typeof row.asset_quantity === "number" ||
    typeof row.asset_quantity === "string"
      ? { assetQuantity: Number(row.asset_quantity) }
      : {}),
    ...(typeof row.asset_unit === "string"
      ? { assetUnit: row.asset_unit as Account["assetUnit"] }
      : {}),
    ...(typeof row.purchase_price === "number" ||
    typeof row.purchase_price === "string"
      ? { purchasePrice: Number(row.purchase_price) }
      : {}),
    ...(typeof row.market_price === "number" ||
    typeof row.market_price === "string"
      ? { marketPrice: Number(row.market_price) }
      : {}),
    ...(typeof row.market_updated_at === "string"
      ? { marketUpdatedAt: row.market_updated_at }
      : {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.is_archived ? { archivedAt: String(row.updated_at) } : {}),
  };
}

export function categoryFromRow(
  row: Record<string, unknown>,
  sortOrder: number,
): Category {
  return {
    id: String(row.id),
    ownerUserId:
      typeof row.owner_user_id === "string" ? row.owner_user_id : undefined,
    familyId: typeof row.family_id === "string" ? row.family_id : undefined,
    scopeType: row.family_id ? "family" : "personal",
    name: String(row.name),
    transactionType: row.category_type as TransactionType,
    sortOrder,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.is_archived ? { archivedAt: String(row.updated_at) } : {}),
  };
}

export function transactionFromRow(
  row: Record<string, unknown>,
): FinancialTransaction {
  return {
    id: String(row.id),
    ownerUserId:
      typeof row.owner_user_id === "string" ? row.owner_user_id : undefined,
    familyId: typeof row.family_id === "string" ? row.family_id : undefined,
    scopeType: row.family_id ? "family" : "personal",
    accountId: String(row.account_id),
    categoryId: String(row.category_id),
    transactionType: row.transaction_type as TransactionType,
    amount: Number(row.amount),
    transactionDate: String(row.transaction_date),
    note: typeof row.description === "string" ? row.description : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function transferFromRow(row: Record<string, unknown>): Transfer {
  return {
    id: String(row.id),
    ownerUserId:
      typeof row.owner_user_id === "string" ? row.owner_user_id : undefined,
    familyId: typeof row.family_id === "string" ? row.family_id : undefined,
    scopeType: row.family_id ? "family" : "personal",
    fromAccountId: String(row.from_account_id),
    toAccountId: String(row.to_account_id),
    amount: Number(row.amount),
    transferDate: String(row.transfer_date),
    note: typeof row.description === "string" ? row.description : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
