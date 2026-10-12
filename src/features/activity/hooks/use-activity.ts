import { useCallback, useEffect, useState } from "react";
import {
  deleteTransaction,
  listTransactionsPage,
} from "@/features/transactions/api/transactions-api";
import { listAccounts } from "@/features/wallets/api/wallets-api";
import { listCategories } from "@/features/transactions/api/categories-api";
import { ensureFinanceDefaults } from "@/features/finance/api/initialization-api";
import type { TransactionCursor } from "@/features/transactions/types";
import type {
  Account,
  Category,
  FinancialTransaction,
} from "@/types/data-model";

const ACTIVITY_PAGE_SIZE = 50;

function getMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

export function useActivity() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [activityReady, setActivityReady] = useState(false);
  const [page, setPage] = useState(0);
  const [pageCursors, setPageCursors] = useState<
    Array<TransactionCursor | null>
  >([null]);
  const [nextPageCursor, setNextPageCursor] =
    useState<TransactionCursor | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [deleting, setDeleting] = useState<FinancialTransaction | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await ensureFinanceDefaults();
      const [nextAccounts, nextCategories] = await Promise.all([
        listAccounts(),
        listCategories(),
      ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setActivityReady(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(() => refresh())
      .catch((reason: unknown) => {
        setError(getMessage(reason, "Gagal memuat aktivitas."));
      });
  }, [refresh]);

  useEffect(() => {
    if (!activityReady) return;
    let active = true;
    const timer = window.setTimeout(
      () => {
        setTransactionsLoading(true);
        void listTransactionsPage(
          pageCursors[page] ?? null,
          ACTIVITY_PAGE_SIZE,
          search,
        )
          .then((result) => {
            if (!active) return;
            setTransactions(result.transactions);
            setNextPageCursor(result.nextCursor);
            setHasNextPage(result.hasNextPage);
            setError("");
          })
          .catch((reason: unknown) => {
            if (active) {
              setError(getMessage(reason, "Gagal memuat transaksi."));
            }
          })
          .finally(() => {
            if (active) setTransactionsLoading(false);
          });
      },
      search ? 250 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activityReady, page, pageCursors, refreshVersion, search]);

  useEffect(() => {
    if (!activityReady) return;
    const handleCloudUpdate = () => {
      setRefreshVersion((version) => version + 1);
      setPage(0);
      setPageCursors([null]);
      setNextPageCursor(null);
      void Promise.all([listAccounts(), listCategories()])
        .then(([nextAccounts, nextCategories]) => {
          setAccounts(nextAccounts);
          setCategories(nextCategories);
        })
        .catch((reason: unknown) => {
          setError(getMessage(reason, "Gagal memperbarui aktivitas."));
        });
    };
    window.addEventListener("cloud-sync-updated", handleCloudUpdate);
    return () =>
      window.removeEventListener("cloud-sync-updated", handleCloudUpdate);
  }, [activityReady]);

  const onSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
    setPageCursors([null]);
    setNextPageCursor(null);
  }, []);

  const onPageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < page) {
        setPage(nextPage);
        return;
      }
      if (!nextPageCursor) return;
      setPageCursors((cursors) => [
        ...cursors.slice(0, page + 1),
        nextPageCursor,
      ]);
      setPage(nextPage);
    },
    [nextPageCursor, page],
  );

  const removeTransaction = useCallback(
    async (transaction: FinancialTransaction): Promise<boolean> => {
      setError("");
      setMessage("");
      setDeletingBusy(true);
      try {
        await deleteTransaction(transaction.id);
        setMessage("Transaksi dihapus permanen.");
        setPage(0);
        setPageCursors([null]);
        setNextPageCursor(null);
        setRefreshVersion((version) => version + 1);
        return true;
      } catch (reason) {
        setError(getMessage(reason, "Transaksi gagal dihapus."));
        return false;
      } finally {
        setDeletingBusy(false);
      }
    },
    [],
  );

  return {
    transactions,
    accounts,
    categories,
    search,
    message,
    setMessage,
    error,
    setError,
    loading,
    transactionsLoading,
    page,
    hasNextPage,
    deleting,
    setDeleting,
    deletingBusy,
    pageSize: ACTIVITY_PAGE_SIZE,
    onSearchChange,
    onPageChange,
    removeTransaction,
  };
}
