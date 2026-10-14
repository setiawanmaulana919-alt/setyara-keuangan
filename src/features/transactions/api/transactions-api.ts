import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { FinancialTransaction, Transfer } from "@/types/data-model";
import {
  id,
  TRANSACTION_COLUMNS,
  TRANSFER_COLUMNS,
  assertPositiveInteger,
  assertDateRange,
  assertDate,
  currentUserId,
  transactionFromRow,
  transferFromRow,
} from "@/features/finance/api/shared";
import type {
  TransactionInput,
  TransferInput,
  TransactionPeriodTotal,
  TransactionPage,
  TransactionCursor,
} from "@/features/transactions/types";
import { isGoalCategoryName } from "@/features/transactions/api/categories-api";
import { assertAccountCanSpend } from "@/features/wallets/api/wallets-api";

export async function saveTransaction(
  input: TransactionInput,
  existingId?: string,
  requestId?: string,
): Promise<FinancialTransaction> {
  assertPositiveInteger(input.amount, "amount");
  assertDate(input.transactionDate, "transactionDate");
  const userId = await currentUserId();
  const client = getSupabaseBrowserClient();
  const [
    { data: account, error: accountError },
    { data: category, error: categoryError },
  ] = await Promise.all([
    client
      .from("wallets")
      .select("id, owner_user_id, family_id")
      .eq("id", input.accountId)
      .maybeSingle(),
    client
      .from("categories")
      .select("id, owner_user_id, family_id, category_type, name")
      .eq("id", input.categoryId)
      .maybeSingle(),
  ]);
  if (accountError) throw accountError;
  if (categoryError) throw categoryError;
  if (!account) throw new Error("Akun transaksi tidak ditemukan.");
  if (!category) throw new Error("Kategori transaksi tidak ditemukan.");
  if (isGoalCategoryName(category.name)) {
    throw new Error(
      "Kategori Target keuangan hanya digunakan oleh fitur Target.",
    );
  }
  if (
    category.owner_user_id !== account.owner_user_id ||
    category.family_id !== account.family_id ||
    category.category_type !== input.transactionType
  ) {
    throw new Error("Kategori tidak sesuai dengan akun atau jenis transaksi.");
  }

  let existingTransaction: {
    owner_user_id: string | null;
    family_id: string | null;
    account_id: string;
    transaction_type: "income" | "expense";
    amount: number;
  } | null = null;
  if (existingId) {
    const { data: existing, error: existingError } = await client
      .from("financial_transactions")
      .select(
        "id, owner_user_id, family_id, account_id, transaction_type, amount",
      )
      .eq("id", existingId)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing)
      throw new Error("Transaksi tidak ditemukan atau sudah dihapus.");
    if (
      existing.owner_user_id !== account.owner_user_id ||
      existing.family_id !== account.family_id
    ) {
      throw new Error(
        "Transaksi tidak dapat dipindahkan ke lingkup akun lain.",
      );
    }
    existingTransaction = existing;
  } else if (requestId) {
    const { data: duplicate, error: duplicateError } = await client
      .from("financial_transactions")
      .select(`${TRANSACTION_COLUMNS}, created_by, deleted_at`)
      .eq("id", requestId)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate?.deleted_at === null && duplicate.created_by === userId) {
      const matches =
        duplicate.owner_user_id === account.owner_user_id &&
        duplicate.family_id === account.family_id &&
        duplicate.account_id === input.accountId &&
        duplicate.category_id === input.categoryId &&
        duplicate.transaction_type === input.transactionType &&
        Number(duplicate.amount) === input.amount &&
        duplicate.transaction_date === input.transactionDate &&
        (duplicate.description ?? null) === (input.note ?? null);
      if (matches) return transactionFromRow(duplicate);
    }
  }

  if (input.transactionType === "expense") {
    const balanceAdjustment =
      existingTransaction?.account_id === input.accountId
        ? existingTransaction.transaction_type === "expense"
          ? Number(existingTransaction.amount)
          : -Number(existingTransaction.amount)
        : 0;
    await assertAccountCanSpend(
      input.accountId,
      input.amount,
      balanceAdjustment,
    );
  }

  const row = {
    id: existingId ?? requestId ?? id(),
    owner_user_id: account.owner_user_id,
    family_id: account.family_id,
    account_id: input.accountId,
    category_id: input.categoryId,
    transaction_type: input.transactionType,
    amount: input.amount,
    transaction_date: input.transactionDate,
    description: input.note ?? null,
  };
  if (existingId) {
    const { data, error } = await client
      .from("financial_transactions")
      .update(row)
      .eq("id", existingId)
      .is("deleted_at", null)
      .select(TRANSACTION_COLUMNS)
      .single();
    if (error) throw error;
    return transactionFromRow(data);
  }

  const { data, error } = await client
    .from("financial_transactions")
    .insert({ ...row, created_by: userId })
    .select(TRANSACTION_COLUMNS)
    .single();
  if (error?.code === "23505" && requestId) {
    const { data: duplicate, error: duplicateError } = await client
      .from("financial_transactions")
      .select(`${TRANSACTION_COLUMNS}, created_by, deleted_at`)
      .eq("id", requestId)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (
      duplicate &&
      duplicate.deleted_at === null &&
      duplicate.created_by === userId &&
      duplicate.owner_user_id === account.owner_user_id &&
      duplicate.family_id === account.family_id &&
      duplicate.account_id === input.accountId &&
      duplicate.category_id === input.categoryId &&
      duplicate.transaction_type === input.transactionType &&
      Number(duplicate.amount) === input.amount &&
      duplicate.transaction_date === input.transactionDate &&
      (duplicate.description ?? null) === (input.note ?? null)
    ) {
      return transactionFromRow(duplicate);
    }
  }
  if (error) throw error;
  return transactionFromRow(data);
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient().rpc("delete_transaction", {
    target_transaction_id: transactionId,
  });
  if (error) throw error;
}

export async function createTransfer(input: TransferInput): Promise<Transfer> {
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Akun asal dan tujuan harus berbeda.");
  }
  assertPositiveInteger(input.amount, "amount");
  assertDate(input.transferDate, "transferDate");
  const userId = await currentUserId();
  const client = getSupabaseBrowserClient();
  const [
    { data: fromAccount, error: fromError },
    { data: toAccount, error: toError },
  ] = await Promise.all([
    client
      .from("wallets")
      .select("id, owner_user_id, family_id")
      .eq("id", input.fromAccountId)
      .maybeSingle(),
    client
      .from("wallets")
      .select("id, owner_user_id, family_id")
      .eq("id", input.toAccountId)
      .maybeSingle(),
  ]);
  if (fromError) throw fromError;
  if (toError) throw toError;
  if (!fromAccount || !toAccount) {
    throw new Error("Akun transfer tidak ditemukan.");
  }
  if (
    fromAccount.owner_user_id !== toAccount.owner_user_id ||
    fromAccount.family_id !== toAccount.family_id
  ) {
    throw new Error("Akun transfer harus berada pada lingkup yang sama.");
  }

  if (input.requestId) {
    const { data: duplicate, error: duplicateError } = await client
      .from("wallet_transfers")
      .select(`${TRANSFER_COLUMNS}, created_by, deleted_at`)
      .eq("id", input.requestId)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (
      duplicate?.deleted_at === null &&
      duplicate.created_by === userId &&
      duplicate.owner_user_id === fromAccount.owner_user_id &&
      duplicate.family_id === fromAccount.family_id &&
      duplicate.from_account_id === input.fromAccountId &&
      duplicate.to_account_id === input.toAccountId &&
      Number(duplicate.amount) === input.amount &&
      duplicate.transfer_date === input.transferDate &&
      (duplicate.description ?? null) === (input.note ?? null)
    ) {
      return transferFromRow(duplicate);
    }
  }
  await assertAccountCanSpend(input.fromAccountId, input.amount);

  const transferRow = {
    id: input.requestId ?? id(),
    owner_user_id: fromAccount.owner_user_id,
    family_id: fromAccount.family_id,
    from_account_id: input.fromAccountId,
    to_account_id: input.toAccountId,
    amount: input.amount,
    transfer_date: input.transferDate,
    description: input.note ?? null,
    created_by: userId,
  };
  const { data, error } = await client
    .from("wallet_transfers")
    .insert(transferRow)
    .select(TRANSFER_COLUMNS)
    .single();
  if (error?.code === "23505" && input.requestId) {
    const { data: duplicate, error: duplicateError } = await client
      .from("wallet_transfers")
      .select(`${TRANSFER_COLUMNS}, created_by, deleted_at`)
      .eq("id", input.requestId)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (
      duplicate &&
      duplicate.deleted_at === null &&
      duplicate.created_by === userId &&
      duplicate.owner_user_id === transferRow.owner_user_id &&
      duplicate.family_id === transferRow.family_id &&
      duplicate.from_account_id === input.fromAccountId &&
      duplicate.to_account_id === input.toAccountId &&
      Number(duplicate.amount) === input.amount &&
      duplicate.transfer_date === input.transferDate &&
      (duplicate.description ?? null) === (input.note ?? null)
    ) {
      return transferFromRow(duplicate);
    }
  }
  if (error) throw error;
  return transferFromRow(data);
}

export async function listTransactionsPage(
  cursor: TransactionCursor | null,
  pageSize: number,
  search = "",
): Promise<TransactionPage> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new Error("Ukuran halaman transaksi tidak valid.");
  }

  let query = getSupabaseBrowserClient()
    .from("financial_transactions")
    .select(TRANSACTION_COLUMNS)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (cursor) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(cursor.transactionDate) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        cursor.createdAt,
      ) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cursor.id,
      )
    ) {
      throw new Error("Kursor transaksi tidak valid.");
    }
    query = query.or(
      `transaction_date.lt.${cursor.transactionDate},and(transaction_date.eq.${cursor.transactionDate},created_at.lt.${cursor.createdAt}),and(transaction_date.eq.${cursor.transactionDate},created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }
  const normalizedSearch = search.trim().slice(0, 100);
  if (normalizedSearch) {
    const pattern = normalizedSearch.replace(/[\\%_]/g, "\\$&");
    query = query.ilike("description", `%${pattern}%`);
  }
  const { data, error } = await query.limit(pageSize + 1);
  if (error) throw error;
  const rows = data ?? [];
  const hasNextPage = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  const lastRow = pageRows.at(-1);
  return {
    transactions: pageRows.map((row) => transactionFromRow(row)),
    nextCursor:
      hasNextPage && lastRow
        ? {
            transactionDate: String(lastRow.transaction_date),
            createdAt: String(lastRow.created_at),
            id: String(lastRow.id),
          }
        : null,
    hasNextPage,
  };
}

export async function getTransactionPeriodTotals(
  from: string,
  to: string,
  groupByMonth: boolean,
): Promise<TransactionPeriodTotal[]> {
  assertDate(from, "from");
  assertDate(to, "to");
  assertDateRange(from, to);
  const { data, error } = await getSupabaseBrowserClient().rpc(
    "get_transaction_period_totals",
    {
      start_date: from,
      end_date: to,
      group_by_month: groupByMonth,
    },
  );
  if (error) throw error;
  if (!Array.isArray(data)) {
    throw new Error("Respons ringkasan transaksi dari Supabase tidak valid.");
  }
  return data.map((row) => {
    if (
      typeof row.period_start !== "string" ||
      (row.transaction_type !== "income" &&
        row.transaction_type !== "expense") ||
      (row.category_id !== null && typeof row.category_id !== "string") ||
      (typeof row.amount !== "number" && typeof row.amount !== "string")
    ) {
      throw new Error("Respons ringkasan transaksi dari Supabase tidak valid.");
    }
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) {
      throw new Error(
        "Supabase mengembalikan jumlah transaksi yang tidak valid.",
      );
    }
    return {
      periodStart: row.period_start,
      transactionType: row.transaction_type,
      ...(row.category_id ? { categoryId: row.category_id } : {}),
      amount,
    };
  });
}
