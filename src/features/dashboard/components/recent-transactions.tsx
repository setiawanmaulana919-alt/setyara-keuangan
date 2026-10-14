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

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function RecentTransactions({
  transactions,
  transfers,
  accounts,
  categories,
}: {
  transactions: FinancialTransaction[];
  transfers: Transfer[];
  accounts: Account[];
  categories: Category[];
}) {
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
  const [selectedTransaction, setSelectedTransaction] =
    useState<FinancialTransaction | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(
    null,
  );
  const selectedCategory = selectedTransaction
    ? categories.find((item) => item.id === selectedTransaction.categoryId)
    : undefined;
  const selectedAccount = selectedTransaction
    ? accounts.find((item) => item.id === selectedTransaction.accountId)
    : undefined;
  const selectedTitle = selectedTransaction
    ? selectedTransaction.note || selectedCategory?.name || "Transaksi"
    : "";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Aktivitas
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">
            Transaksi terbaru
          </h2>
        </div>
        <a
          href="/activity"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          Lihat semua →
        </a>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
        {activities.length === 0 ? (
          <p className="bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-500">
            Belum ada transaksi.
          </p>
        ) : (
          activities.slice(0, 5).map((activity, index) => {
            if (activity.kind === "transfer") {
              const transfer = activity.value;
              return (
                <article
                  key={transfer.id}
                  role="button"
                  tabIndex={0}
                  aria-label="Lihat detail transfer"
                  onClick={() => setSelectedTransfer(transfer)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedTransfer(transfer);
                    }
                  }}
                  className={`grid min-h-[72px] min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:gap-4 sm:px-4 ${index > 0 ? "border-t border-slate-100" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-base font-semibold text-blue-700"
                  >
                    ↔
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {accounts.find(
                        (item) => item.id === transfer.fromAccountId,
                      )?.name ?? "Akun"}{" "}
                      →{" "}
                      {accounts.find((item) => item.id === transfer.toAccountId)
                        ?.name ?? "Akun"}
                    </p>
                    <p className="mt-1 truncate text-[11px] leading-4 text-slate-500">
                      Transfer
                      {transfer.transferFee > 0
                        ? ` · Biaya ${currency.format(transfer.transferFee)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col items-end gap-1">
                    <span className="whitespace-nowrap text-right text-sm font-bold tabular-nums text-slate-800">
                      -{currency.format(transfer.amount + transfer.transferFee)}
                    </span>
                    <TransactionDateTime
                      transactionDate={transfer.transferDate}
                      recordedAt={transfer.createdAt}
                    />
                  </div>
                </article>
              );
            }
            const transaction = activity.value;
            const category = categories.find(
              (item) => item.id === transaction.categoryId,
            );
            const account = accounts.find(
              (item) => item.id === transaction.accountId,
            );
            const income = transaction.transactionType === "income";
            return (
              <article
                key={transaction.id}
                role="button"
                tabIndex={0}
                aria-label={`Lihat detail transaksi: ${transaction.note || category?.name || "Transaksi"}`}
                onClick={() => setSelectedTransaction(transaction)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedTransaction(transaction);
                  }
                }}
                className={`grid min-h-[72px] min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:gap-4 sm:px-4 ${
                  index > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${income ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                >
                  {income ? "↗" : "↘"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {transaction.note || category?.name || "Transaksi"}
                  </p>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[11px] leading-4 text-slate-500">
                      {account?.name ?? "Akun"}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col items-end gap-1">
                  <span
                    className={`whitespace-nowrap text-right text-sm font-bold tabular-nums ${income ? "text-emerald-700" : "text-slate-800"}`}
                  >
                    {income ? "+" : "-"}
                    {currency.format(transaction.amount)}
                  </span>
                  <TransactionDateTime
                    transactionDate={transaction.transactionDate}
                    recordedAt={transaction.createdAt}
                  />
                </div>
              </article>
            );
          })
        )}
        {selectedTransfer && (
          <TransferDetailsDialog
            transfer={selectedTransfer}
            fromAccountName={
              accounts.find(
                (item) => item.id === selectedTransfer.fromAccountId,
              )?.name ?? "Akun tidak dikenal"
            }
            toAccountName={
              accounts.find((item) => item.id === selectedTransfer.toAccountId)
                ?.name ?? "Akun tidak dikenal"
            }
            onClose={() => setSelectedTransfer(null)}
          />
        )}
      </div>
      {selectedTransaction && (
        <TransactionDetailsDialog
          transaction={selectedTransaction}
          title={selectedTitle}
          accountName={selectedAccount?.name ?? "Akun tidak dikenal"}
          categoryName={selectedCategory?.name ?? "Kategori tidak dikenal"}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </section>
  );
}
