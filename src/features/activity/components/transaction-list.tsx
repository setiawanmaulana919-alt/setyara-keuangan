"use client";

import { useState } from "react";
import type {
  Account,
  Category,
  FinancialTransaction,
  Transfer,
} from "@/types/data-model";
import { TransactionDateTime } from "@/features/transactions/components/transaction-date-time";
import {
  TransactionDetailsDialog,
  TransferDetailsDialog,
} from "@/features/transactions/components/transaction-details";
import { isGoalCategoryName } from "@/features/transactions/api/categories-api";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

interface TransactionListProps {
  transactions: FinancialTransaction[];
  transfers: Transfer[];
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
  onEditTransfer: (transfer: Transfer) => void;
  onDeleteTransfer: (transfer: Transfer) => void;
}

export function TransactionList({
  transactions,
  transfers,
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
  onEditTransfer,
  onDeleteTransfer,
}: TransactionListProps) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<FinancialTransaction | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(
    null,
  );
  const sortedTransactions = [...transactions].sort(
    (left, right) =>
      right.transactionDate.localeCompare(left.transactionDate) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
  const activities = [
    ...sortedTransactions.map((transaction) => ({
      kind: "transaction" as const,
      value: transaction,
      date: transaction.transactionDate,
      createdAt: transaction.createdAt,
      id: transaction.id,
    })),
    ...transfers.map((transfer) => ({
      kind: "transfer" as const,
      value: transfer,
      date: transfer.transferDate,
      createdAt: transfer.createdAt,
      id: transfer.id,
    })),
  ].sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ||
    "Kategori tidak dikenal";
  const accountName = (id: string) =>
    accounts.find((account) => account.id === id)?.name || "Akun tidak dikenal";
  const selectedTitle = selectedTransaction
    ? selectedTransaction.note || categoryName(selectedTransaction.categoryId)
    : "";

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
          {activities.length === 0 ? (
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
              {activities.map((activity) => {
                if (activity.kind === "transfer") {
                  const transfer = activity.value;
                  return (
                    <article
                      key={transfer.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Lihat detail transfer: ${accountName(transfer.fromAccountId)} ke ${accountName(transfer.toAccountId)}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedTransfer(transfer);
                        }
                      }}
                      onClick={() => setSelectedTransfer(transfer)}
                      className="grid min-h-[72px] min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:gap-4 sm:px-4"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-base font-semibold text-blue-700"
                      >
                        ↔
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {accountName(transfer.fromAccountId)} →{" "}
                          {accountName(transfer.toAccountId)}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-slate-500">
                          Transfer
                          {transfer.note ? ` · ${transfer.note}` : ""}
                          {transfer.transferFee > 0
                            ? ` · Biaya ${currency.format(transfer.transferFee)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-col items-end justify-center gap-1">
                        <span className="whitespace-nowrap text-sm font-bold tabular-nums text-slate-800">
                          -
                          {currency.format(
                            transfer.amount + transfer.transferFee,
                          )}
                        </span>
                        <TransactionDateTime
                          transactionDate={transfer.transferDate}
                          recordedAt={transfer.createdAt}
                        />
                      </div>
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Edit transfer"
                          title="Edit transfer"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditTransfer(transfer);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3.5 w-3.5"
                          >
                            <path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label="Hapus transfer"
                          title="Hapus transfer"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteTransfer(transfer);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3.5 w-3.5"
                          >
                            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
                          </svg>
                        </button>
                      </div>
                    </article>
                  );
                }
                const transaction = activity.value;
                const isIncome = transaction.transactionType === "income";
                const isGoalProgress = categories.some(
                  (category) =>
                    category.id === transaction.categoryId &&
                    isGoalCategoryName(category.name),
                );
                const title =
                  transaction.note || categoryName(transaction.categoryId);
                return (
                  <article
                    key={transaction.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Lihat detail transaksi: ${title}`}
                    onClick={() => setSelectedTransaction(transaction)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTransaction(transaction);
                      }
                    }}
                    className="grid min-h-[72px] min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:gap-4 sm:px-4"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${
                        isIncome
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {isIncome ? "↗" : "↘"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {title}
                      </p>
                      <div className="mt-1 flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-[11px] leading-4 text-slate-500">
                          {accountName(transaction.accountId)}
                        </p>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col items-end justify-center gap-1">
                      <span
                        className={`whitespace-nowrap text-sm font-bold tabular-nums ${
                          isIncome ? "text-emerald-700" : "text-slate-800"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {currency.format(transaction.amount)}
                      </span>
                      <TransactionDateTime
                        transactionDate={transaction.transactionDate}
                        recordedAt={transaction.createdAt}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      {isGoalProgress ? (
                        <span
                          aria-label="Transaksi ini dikelola dari Target, tidak dapat diedit atau dihapus"
                          title="Dikelola dari Target"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3.5 w-3.5"
                          >
                            <rect x="5" y="10" width="14" height="11" rx="2" />
                            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                          </svg>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label={`Edit ${title}`}
                            title="Edit transaksi"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEdit(transaction);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-3.5 w-3.5"
                            >
                              <path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            aria-label={`Hapus ${title}`}
                            title="Hapus transaksi"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(transaction);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-3.5 w-3.5"
                            >
                              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
                            </svg>
                          </button>
                        </>
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
          {activities.length === 0
            ? "Tidak ada transaksi"
            : `${page * pageSize + 1}–${page * pageSize + activities.length} aktivitas`}
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
      {selectedTransaction && (
        <TransactionDetailsDialog
          transaction={selectedTransaction}
          title={selectedTitle}
          accountName={accountName(selectedTransaction.accountId)}
          categoryName={categoryName(selectedTransaction.categoryId)}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
      {selectedTransfer && (
        <TransferDetailsDialog
          transfer={selectedTransfer}
          fromAccountName={accountName(selectedTransfer.fromAccountId)}
          toAccountName={accountName(selectedTransfer.toAccountId)}
          onClose={() => setSelectedTransfer(null)}
        />
      )}
    </>
  );
}
