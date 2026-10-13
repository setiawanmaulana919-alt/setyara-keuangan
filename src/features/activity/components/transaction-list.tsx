"use client";

import { useMemo, useSyncExternalStore } from "react";
import type {
  Account,
  Category,
  FinancialTransaction,
} from "@/types/data-model";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const subscribeToTimeZone = () => () => {};
const getTimeZoneSnapshot = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTimeZoneSnapshot = () => "UTC";

interface TransactionListProps {
  transactions: FinancialTransaction[];
  accounts: Account[];
  categories: Category[];
  search: string;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  loading: boolean;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onEdit: (transaction: FinancialTransaction) => void;
  onDelete: (transaction: FinancialTransaction) => void;
}

export function TransactionList({
  transactions,
  accounts,
  categories,
  search,
  page,
  pageSize,
  hasNextPage,
  loading,
  onSearchChange,
  onPageChange,
  onEdit,
  onDelete,
}: TransactionListProps) {
  const timeZone = useSyncExternalStore(
    subscribeToTimeZone,
    getTimeZoneSnapshot,
    getServerTimeZoneSnapshot,
  );
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    [timeZone],
  );
  const sortedTransactions = [...transactions].sort(
    (left, right) =>
      right.transactionDate.localeCompare(left.transactionDate) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );

  const accountName = (id: string) =>
    accounts.find((account) => account.id === id)?.name || "Akun tidak dikenal";
  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ||
    "Kategori tidak dikenal";

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            Semua aktivitas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Lihat dan kelola seluruh transaksi keuanganmu.
          </p>
        </div>
        <label className="block w-full sm:max-w-sm">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
            Cari transaksi
          </span>
          <span className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4 shrink-0 text-slate-400"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Catatan, kategori, atau akun"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
            />
          </span>
        </label>
      </div>
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Memuat transaksi...
        </p>
      ) : (
        <div
          role="region"
          aria-label="Daftar transaksi"
          className="mt-5 overflow-hidden rounded-xl border border-slate-100"
        >
          {transactions.length === 0 ? (
            <div className="bg-slate-50/60 px-4 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                {search.trim()
                  ? "Tidak ada transaksi yang cocok."
                  : "Belum ada transaksi."}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Tambahkan transaksi untuk mulai mencatat aktivitas keuanganmu.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 [touch-action:pan-y]">
              {sortedTransactions.map((transaction) => {
                const isIncome = transaction.transactionType === "income";
                const isGoalProgress = categories.some(
                  (category) =>
                    category.id === transaction.categoryId &&
                    category.name === "Target keuangan",
                );
                const title =
                  transaction.note || categoryName(transaction.categoryId);
                return (
                  <article
                    key={transaction.id}
                    className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3.5 transition-colors hover:bg-slate-50 sm:gap-4 sm:px-4"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-semibold ring-1 ring-inset ${
                        isIncome
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                          : "bg-rose-50 text-rose-700 ring-rose-100"
                      }`}
                    >
                      {isIncome ? "↗" : "↘"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                          {title}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          {categoryName(transaction.categoryId)}
                        </span>
                      </div>
                      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                        {accountName(transaction.accountId)}
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <time dateTime={transaction.transactionDate}>
                          {transaction.transactionDate}
                        </time>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <time
                          dateTime={transaction.createdAt}
                          aria-label={`Dicatat pukul ${time.format(new Date(transaction.createdAt))}`}
                          className="tabular-nums"
                        >
                          {time.format(new Date(transaction.createdAt))}
                        </time>
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-col items-end gap-1.5">
                      <span
                        className={`whitespace-nowrap text-sm font-bold tabular-nums ${
                          isIncome ? "text-emerald-700" : "text-slate-800"
                        }`}
                      >
                        {isIncome ? "+" : "−"}
                        {currency.format(transaction.amount)}
                      </span>
                      {isGoalProgress ? (
                        <span className="text-[11px] font-medium text-slate-400">
                          Kelola dari Target
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] font-semibold">
                          <button
                            type="button"
                            aria-label={`Edit ${title}`}
                            onClick={() => onEdit(transaction)}
                            className="rounded-md px-1.5 py-0.5 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            aria-label={`Hapus ${title}`}
                            onClick={() => onDelete(transaction)}
                            className="rounded-md px-1.5 py-0.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
                          >
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p aria-live="polite" className="min-w-0 text-xs text-slate-500">
          {transactions.length === 0
            ? "Tidak ada transaksi"
            : `${page * pageSize + 1}–${page * pageSize + transactions.length} transaksi`}
        </p>
        <nav
          aria-label="Navigasi halaman aktivitas"
          className="flex shrink-0 items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={loading || page <= 0}
            aria-label="Halaman sebelumnya"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span
            aria-live="polite"
            className="min-w-16 text-center text-xs font-medium text-slate-600"
          >
            Halaman <span className="tabular-nums">{page + 1}</span>
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={loading || !hasNextPage}
            aria-label="Halaman berikutnya"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </nav>
      </div>
    </>
  );
}
