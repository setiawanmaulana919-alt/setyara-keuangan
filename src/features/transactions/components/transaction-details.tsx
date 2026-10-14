"use client";

import { useEffect } from "react";
import type { FinancialTransaction, Transfer } from "@/types/data-model";
import { TransactionDateTime } from "@/features/transactions/components/transaction-date-time";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function TransactionDetailButton({
  text,
  className,
  onClick,
}: {
  text: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Lihat detail transaksi: ${text}`}
      title={text}
      onClick={onClick}
      className={`${className} block w-full truncate text-left focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`}
    >
      {text}
    </button>
  );
}

export function TransactionDetailsDialog({
  transaction,
  title,
  accountName,
  categoryName,
  onClose,
}: {
  transaction: FinancialTransaction;
  title: string;
  accountName: string;
  categoryName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isIncome = transaction.transactionType === "income";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-details-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-white/70 bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Detail transaksi
            </p>
            <h2
              id="transaction-details-title"
              className="mt-2 break-words text-xl font-bold tracking-tight text-slate-950"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail transaksi"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-500 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            ×
          </button>
        </div>

        <p
          className={`mt-5 text-2xl font-bold tabular-nums ${
            isIncome ? "text-emerald-700" : "text-slate-900"
          }`}
        >
          {isIncome ? "+" : "-"}
          {currency.format(transaction.amount)}
        </p>

        <dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-slate-500">Jenis</dt>
            <dd className="text-right text-sm font-medium text-slate-800">
              {isIncome ? "Pemasukan" : "Pengeluaran"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-slate-500">Akun</dt>
            <dd className="max-w-[65%] break-words text-right text-sm font-medium text-slate-800">
              {accountName}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-slate-500">Kategori</dt>
            <dd className="max-w-[65%] break-words text-right text-sm font-medium text-slate-800">
              {categoryName}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-slate-500">Tanggal dan waktu</dt>
            <dd className="text-right">
              <TransactionDateTime
                transactionDate={transaction.transactionDate}
                recordedAt={transaction.createdAt}
              />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export function TransferDetailsDialog({
  transfer,
  fromAccountName,
  toAccountName,
  onClose,
}: {
  transfer: Transfer;
  fromAccountName: string;
  toAccountName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-details-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-white/70 bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Detail aktivitas
            </p>
            <h2
              id="transfer-details-title"
              className="mt-2 break-words text-xl font-bold tracking-tight text-slate-950"
            >
              Transfer
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail transfer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-500 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            ×
          </button>
        </div>
        <p className="mt-5 text-2xl font-bold tabular-nums text-slate-900">
          -{currency.format(transfer.amount + transfer.transferFee)}
        </p>
        <dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-slate-500">Dari akun</dt>
            <dd className="max-w-[65%] break-words text-right text-sm font-medium text-slate-800">
              {fromAccountName}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-slate-500">Ke akun</dt>
            <dd className="max-w-[65%] break-words text-right text-sm font-medium text-slate-800">
              {toAccountName}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-slate-500">Nominal</dt>
            <dd className="text-right text-sm font-medium text-slate-800">
              {currency.format(transfer.amount)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-slate-500">Biaya transfer</dt>
            <dd className="text-right text-sm font-medium text-slate-800">
              {currency.format(transfer.transferFee)}
            </dd>
          </div>
          {transfer.note && (
            <div className="flex items-start justify-between gap-4 py-3">
              <dt className="text-sm text-slate-500">Catatan</dt>
              <dd className="max-w-[65%] break-words text-right text-sm font-medium text-slate-800">
                {transfer.note}
              </dd>
            </div>
          )}
          <div className="flex items-start justify-between gap-4 py-3">
            <dt className="text-sm text-slate-500">Tanggal dan waktu</dt>
            <dd className="text-right">
              <TransactionDateTime
                transactionDate={transfer.transferDate}
                recordedAt={transfer.createdAt}
              />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
