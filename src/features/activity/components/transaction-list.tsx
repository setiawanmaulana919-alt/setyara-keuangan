"use client";

import { useEffect, useState } from "react";
import type {
  Account,
  Category,
  FinancialTransaction,
  Transfer,
} from "@/types/data-model";
import type { LoanActivity } from "@/features/loans/types";
import { TransactionDateTime } from "@/features/transactions/components/transaction-date-time";
import {
  TransactionDetailsDialog,
  TransferDetailsDialog,
  LoanActivityDetailsDialog,
} from "@/features/transactions/components/transaction-details";
import { isGoalCategoryName } from "@/features/transactions/api/categories-api";
import { DateField } from "@/components/ui/date-field";
import { DropdownField } from "@/components/ui/dropdown-field";
import { TimeField } from "@/components/ui/time-field";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

type ActivityKindFilter = "all" | "transaction" | "transfer" | "loan";
type TransactionKindFilter = "all" | "income" | "expense";
type LoanKindFilter = "all" | "issued" | "repayment";
type LoanDirectionFilter = "all" | "receivable" | "payable";
type AccountTypeFilter =
  | "all"
  | "cash"
  | "bank"
  | "eWallet"
  | "savings"
  | "investment"
  | "receivable"
  | "other";

interface ActivityFilters {
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  accountId: string;
  accountType: AccountTypeFilter;
  activityKind: ActivityKindFilter;
  transactionKind: TransactionKindFilter;
  categoryId: string;
  loanKind: LoanKindFilter;
  loanDirection: LoanDirectionFilter;
}

const EMPTY_FILTERS: ActivityFilters = {
  dateFrom: "",
  dateTo: "",
  timeFrom: "",
  timeTo: "",
  accountId: "",
  accountType: "all",
  activityKind: "all",
  transactionKind: "all",
  categoryId: "",
  loanKind: "all",
  loanDirection: "all",
};

interface TransactionListProps {
  transactions: FinancialTransaction[];
  transfers: Transfer[];
  loanActivities: LoanActivity[];
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
  loanActivities,
  accounts,
  categories,
  search,
  page,
  pageSize,
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
  const [selectedLoanActivity, setSelectedLoanActivity] =
    useState<LoanActivity | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ActivityFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<ActivityFilters>(EMPTY_FILTERS);
  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name ||
    "Kategori tidak dikenal";
  const accountName = (id: string) =>
    accounts.find((account) => account.id === id)?.name || "Akun tidak dikenal";
  const accountMatchesType = (accountId: string) => {
    if (filters.accountType === "all") return true;
    return (
      accounts.find((account) => account.id === accountId)?.accountType ===
      filters.accountType
    );
  };
  const activityMatchesTime = (createdAt: string) => {
    if (!filters.timeFrom && !filters.timeTo) return true;
    const recordedTime = new Date(createdAt).toTimeString().slice(0, 5);
    if (filters.timeFrom && recordedTime < filters.timeFrom) return false;
    if (filters.timeTo && recordedTime > filters.timeTo) return false;
    return true;
  };
  const sortedTransactions = [...transactions].sort(
    (left, right) =>
      right.transactionDate.localeCompare(left.transactionDate) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("id-ID");
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
    ...loanActivities.map((activity) => ({
      kind: "loan" as const,
      value: activity,
      date: activity.activityDate,
      createdAt: activity.createdAt,
      id: activity.id,
    })),
  ]
    .filter((activity) => {
      if (filters.dateFrom && activity.date < filters.dateFrom) return false;
      if (filters.dateTo && activity.date > filters.dateTo) return false;
      if (!activityMatchesTime(activity.createdAt)) return false;
      if (
        filters.activityKind !== "all" &&
        activity.kind !== filters.activityKind
      ) {
        return false;
      }

      if (activity.kind === "transaction") {
        const transaction = activity.value as FinancialTransaction;
        if (!accountMatchesType(transaction.accountId)) return false;
        if (filters.accountId && transaction.accountId !== filters.accountId) {
          return false;
        }
        if (
          filters.transactionKind !== "all" &&
          transaction.transactionType !== filters.transactionKind
        ) {
          return false;
        }
        if (
          filters.categoryId &&
          transaction.categoryId !== filters.categoryId
        ) {
          return false;
        }
      } else if (activity.kind === "transfer") {
        const transfer = activity.value as Transfer;
        if (
          filters.accountType !== "all" &&
          !accountMatchesType(transfer.fromAccountId) &&
          !accountMatchesType(transfer.toAccountId)
        )
          return false;
        if (
          filters.accountId &&
          transfer.fromAccountId !== filters.accountId &&
          transfer.toAccountId !== filters.accountId
        ) {
          return false;
        }
        if (filters.transactionKind !== "all" || filters.categoryId) {
          return false;
        }
      } else {
        const loan = activity.value as LoanActivity;
        if (!accountMatchesType(loan.accountId)) return false;
        if (filters.accountId && loan.accountId !== filters.accountId) {
          return false;
        }
        if (filters.loanKind !== "all" && loan.kind !== filters.loanKind) {
          return false;
        }
        if (
          filters.loanDirection !== "all" &&
          loan.direction !== filters.loanDirection
        ) {
          return false;
        }
        if (filters.transactionKind !== "all" || filters.categoryId) {
          return false;
        }
      }
      return true;
    })
    .filter((activity) => {
      if (!normalizedSearch) return true;
      if (activity.kind === "transaction") {
        const transaction = activity.value as FinancialTransaction;
        return [
          transaction.note,
          categoryName(transaction.categoryId),
          accountName(transaction.accountId),
          String(transaction.amount),
        ].some((value) =>
          value?.toLocaleLowerCase("id-ID").includes(normalizedSearch),
        );
      }
      if (activity.kind === "transfer") {
        const transfer = activity.value as Transfer;
        return [
          transfer.note,
          accountName(transfer.fromAccountId),
          accountName(transfer.toAccountId),
          String(transfer.amount),
        ].some((value) =>
          value?.toLocaleLowerCase("id-ID").includes(normalizedSearch),
        );
      }
      const loan = activity.value as LoanActivity;
      return [
        loan.counterpartyName,
        loan.direction === "receivable" ? "piutang" : "utang",
        accountName(loan.accountId),
        String(loan.amount),
      ].some((value) =>
        value.toLocaleLowerCase("id-ID").includes(normalizedSearch),
      );
    })
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.createdAt.localeCompare(left.createdAt) ||
        right.id.localeCompare(left.id),
    );
  const pageStart = page * pageSize;
  const paginatedActivities = activities.slice(pageStart, pageStart + pageSize);
  const combinedHasNextPage = pageStart + pageSize < activities.length;
  const maxPage = Math.max(0, Math.ceil(activities.length / pageSize) - 1);
  const activeFilterCount = Object.entries(filters).filter(
    ([, value]) => value !== "" && value !== "all",
  ).length;

  useEffect(() => {
    if (page > maxPage) onPageChange(maxPage);
  }, [maxPage, onPageChange, page]);

  const selectedTitle = selectedTransaction
    ? selectedTransaction.note || categoryName(selectedTransaction.categoryId)
    : "";

  const openFilters = () => {
    setDraftFilters(filters);
    setFilterOpen(true);
  };

  const updateDraftFilter = <Key extends keyof ActivityFilters>(
    key: Key,
    value: ActivityFilters[Key],
  ) => setDraftFilters((current) => ({ ...current, [key]: value }));
  const activeFilterChips: Array<{
    key: keyof ActivityFilters;
    label: string;
  }> = [];
  const addFilterChip = (key: keyof ActivityFilters, label: string) => {
    activeFilterChips.push({ key, label });
  };
  const formatFilterDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  };

  if (filters.dateFrom) {
    addFilterChip("dateFrom", `Dari ${formatFilterDate(filters.dateFrom)}`);
  }
  if (filters.dateTo) {
    addFilterChip("dateTo", `Sampai ${formatFilterDate(filters.dateTo)}`);
  }
  if (filters.timeFrom) addFilterChip("timeFrom", `Dari ${filters.timeFrom}`);
  if (filters.timeTo) addFilterChip("timeTo", `Sampai ${filters.timeTo}`);
  if (filters.accountType !== "all") {
    const accountTypeLabels: Record<
      Exclude<AccountTypeFilter, "all">,
      string
    > = {
      cash: "Tunai",
      bank: "Bank",
      eWallet: "Dompet digital",
      savings: "Tabungan",
      investment: "Investasi",
      receivable: "Piutang",
      other: "Lainnya",
    };
    addFilterChip("accountType", accountTypeLabels[filters.accountType]);
  }
  if (filters.accountId) {
    addFilterChip("accountId", accountName(filters.accountId));
  }
  if (filters.activityKind !== "all") {
    const activityKindLabels: Record<
      Exclude<ActivityKindFilter, "all">,
      string
    > = {
      transaction: "Transaksi",
      transfer: "Transfer",
      loan: "Utang & piutang",
    };
    addFilterChip("activityKind", activityKindLabels[filters.activityKind]);
  }
  if (filters.transactionKind !== "all") {
    addFilterChip(
      "transactionKind",
      filters.transactionKind === "income" ? "Pemasukan" : "Pengeluaran",
    );
  }
  if (filters.categoryId) {
    addFilterChip("categoryId", categoryName(filters.categoryId));
  }
  if (filters.loanKind !== "all") {
    addFilterChip(
      "loanKind",
      filters.loanKind === "issued" ? "Pencatatan utang/piutang" : "Pembayaran",
    );
  }
  if (filters.loanDirection !== "all") {
    addFilterChip(
      "loanDirection",
      filters.loanDirection === "receivable" ? "Piutang" : "Utang",
    );
  }

  const removeFilter = <Key extends keyof ActivityFilters>(key: Key) => {
    setFilters((current) => ({ ...current, [key]: EMPTY_FILTERS[key] }));
    onPageChange(0);
  };

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
        <div className="flex w-full items-end gap-2 sm:max-w-md">
          <label className="block min-w-0 flex-1">
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
          <button
            type="button"
            onClick={openFilters}
            aria-label="Filter aktivitas"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path d="M4 5h16M7 12h10M10 19h4" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
      {activeFilterChips.length > 0 && (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          {activeFilterChips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => removeFilter(key)}
              aria-label={`Hapus filter ${label}`}
              className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 text-xs font-medium text-blue-800 hover:border-blue-200 hover:bg-blue-100"
            >
              <span className="truncate">{label}</span>
              <span aria-hidden="true" className="text-sm leading-none">
                ×
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              onPageChange(0);
            }}
            className="min-h-8 px-2 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Hapus semua
          </button>
        </div>
      )}
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
              {paginatedActivities.map((activity) => {
                if (activity.kind === "loan") {
                  const loan = activity.value;
                  const isReceivable = loan.direction === "receivable";
                  const isIssued = loan.kind === "issued";
                  const increasesBalance = isIssued
                    ? !isReceivable
                    : isReceivable;
                  return (
                    <article
                      key={loan.id}
                      role="button"
                      tabIndex={0}
                      aria-label="Lihat detail aktivitas pinjaman"
                      onClick={() => setSelectedLoanActivity(loan)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedLoanActivity(loan);
                        }
                      }}
                      className="grid min-h-[72px] min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:gap-4 sm:px-4"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${increasesBalance ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                      >
                        {increasesBalance ? "↗" : "↘"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {isIssued
                            ? isReceivable
                              ? "Piutang"
                              : "Utang"
                            : "Pembayaran pinjaman"}{" "}
                          · {loan.counterpartyName}
                        </p>
                        <p className="mt-1 truncate text-[11px] leading-4 text-slate-500">
                          {accountName(loan.accountId)}
                          {loan.note ? ` · ${loan.note}` : ""}
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-col items-end justify-center gap-1">
                        <span
                          className={`whitespace-nowrap text-sm font-bold tabular-nums ${increasesBalance ? "text-emerald-700" : "text-slate-800"}`}
                        >
                          {increasesBalance ? "+" : "-"}
                          {currency.format(loan.amount)}
                        </span>
                        <TransactionDateTime
                          transactionDate={loan.activityDate}
                          recordedAt={loan.createdAt}
                        />
                      </div>
                      <span className="h-7 w-7" aria-hidden="true" />
                    </article>
                  );
                }
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
            ? "Tidak ada aktivitas"
            : `${pageStart + 1}–${Math.min(pageStart + pageSize, activities.length)} dari ${activities.length} aktivitas`}
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
            disabled={loading || !combinedHasNextPage}
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
      {selectedLoanActivity && (
        <LoanActivityDetailsDialog
          activity={selectedLoanActivity}
          accountName={accountName(selectedLoanActivity.accountId)}
          onClose={() => setSelectedLoanActivity(null)}
        />
      )}
      {filterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFilterOpen(false);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Filter aktivitas"
            className="max-h-[94vh] w-full min-w-0 max-w-xl overflow-y-auto rounded-t-[30px] border border-white/70 bg-[#f8fafc] p-4 shadow-2xl sm:rounded-[30px] sm:p-7"
          >
            <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path d="M4 5h16M7 12h10M10 19h4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                  Filter aktivitas
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Pilih satu atau beberapa batasan untuk menyaring seluruh
                  aktivitas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                aria-label="Tutup"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl leading-none text-slate-500 shadow-sm hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="mt-6 grid min-w-0 gap-4 rounded-2xl border border-slate-200/80 bg-white p-3 sm:grid-cols-2 sm:p-5">
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Dari tanggal
                <DateField
                  aria-label="Dari tanggal"
                  value={draftFilters.dateFrom}
                  onChange={(value) => updateDraftFilter("dateFrom", value)}
                />
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Sampai tanggal
                <DateField
                  aria-label="Sampai tanggal"
                  min={draftFilters.dateFrom || undefined}
                  value={draftFilters.dateTo}
                  onChange={(value) => updateDraftFilter("dateTo", value)}
                />
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Dari jam
                <TimeField
                  value={draftFilters.timeFrom}
                  onChange={(value) => updateDraftFilter("timeFrom", value)}
                  aria-label="Dari jam"
                />
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Sampai jam
                <TimeField
                  min={draftFilters.timeFrom || undefined}
                  value={draftFilters.timeTo}
                  onChange={(value) => updateDraftFilter("timeTo", value)}
                  aria-label="Sampai jam"
                />
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2">
                Jenis dompet
                <DropdownField
                  aria-label="Jenis dompet"
                  value={draftFilters.accountType}
                  onChange={(value) =>
                    updateDraftFilter("accountType", value as AccountTypeFilter)
                  }
                >
                  <option value="all">Semua jenis dompet</option>
                  <option value="cash">Tunai</option>
                  <option value="bank">Bank</option>
                  <option value="eWallet">Dompet digital</option>
                  <option value="savings">Tabungan</option>
                  <option value="investment">Investasi</option>
                  <option value="receivable">Piutang</option>
                  <option value="other">Lainnya</option>
                </DropdownField>
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2">
                Dompet
                <DropdownField
                  aria-label="Dompet"
                  value={draftFilters.accountId}
                  onChange={(value) => updateDraftFilter("accountId", value)}
                >
                  <option value="">Semua dompet</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </DropdownField>
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Jenis aktivitas
                <DropdownField
                  aria-label="Jenis aktivitas"
                  value={draftFilters.activityKind}
                  onChange={(value) =>
                    updateDraftFilter(
                      "activityKind",
                      value as ActivityKindFilter,
                    )
                  }
                >
                  <option value="all">Semua aktivitas</option>
                  <option value="transaction">Transaksi</option>
                  <option value="transfer">Transfer</option>
                  <option value="loan">Utang & piutang</option>
                </DropdownField>
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Jenis transaksi
                <DropdownField
                  aria-label="Jenis transaksi"
                  disabled={
                    draftFilters.activityKind !== "all" &&
                    draftFilters.activityKind !== "transaction"
                  }
                  value={draftFilters.transactionKind}
                  onChange={(value) =>
                    updateDraftFilter(
                      "transactionKind",
                      value as TransactionKindFilter,
                    )
                  }
                >
                  <option value="all">Semua</option>
                  <option value="income">Pemasukan</option>
                  <option value="expense">Pengeluaran</option>
                </DropdownField>
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700 sm:col-span-2">
                Kategori
                <DropdownField
                  aria-label="Kategori"
                  disabled={
                    draftFilters.activityKind !== "all" &&
                    draftFilters.activityKind !== "transaction"
                  }
                  value={draftFilters.categoryId}
                  onChange={(value) => updateDraftFilter("categoryId", value)}
                >
                  <option value="">Semua kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </DropdownField>
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Operasi utang/piutang
                <DropdownField
                  aria-label="Operasi utang/piutang"
                  disabled={
                    draftFilters.activityKind !== "all" &&
                    draftFilters.activityKind !== "loan"
                  }
                  value={draftFilters.loanKind}
                  onChange={(value) =>
                    updateDraftFilter("loanKind", value as LoanKindFilter)
                  }
                >
                  <option value="all">Semua</option>
                  <option value="issued">Pencatatan</option>
                  <option value="repayment">Pembayaran</option>
                </DropdownField>
              </label>
              <label className="min-w-0 text-sm font-semibold text-slate-700">
                Arah utang/piutang
                <DropdownField
                  aria-label="Arah utang/piutang"
                  disabled={
                    draftFilters.activityKind !== "all" &&
                    draftFilters.activityKind !== "loan"
                  }
                  value={draftFilters.loanDirection}
                  onChange={(value) =>
                    updateDraftFilter(
                      "loanDirection",
                      value as LoanDirectionFilter,
                    )
                  }
                >
                  <option value="all">Semua</option>
                  <option value="receivable">Piutang</option>
                  <option value="payable">Utang</option>
                </DropdownField>
              </label>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  setDraftFilters(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                  onPageChange(0);
                }}
                className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset filter
              </button>
              <div className="flex min-w-0 gap-2">
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 sm:flex-none"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={
                    Boolean(
                      draftFilters.dateFrom &&
                      draftFilters.dateTo &&
                      draftFilters.dateTo < draftFilters.dateFrom,
                    ) ||
                    Boolean(
                      draftFilters.timeFrom &&
                      draftFilters.timeTo &&
                      draftFilters.timeTo < draftFilters.timeFrom,
                    )
                  }
                  onClick={() => {
                    const normalizedFilters = {
                      ...draftFilters,
                      transactionKind:
                        draftFilters.activityKind === "transaction" ||
                        draftFilters.activityKind === "all"
                          ? draftFilters.transactionKind
                          : ("all" as TransactionKindFilter),
                      categoryId:
                        draftFilters.activityKind === "transaction" ||
                        draftFilters.activityKind === "all"
                          ? draftFilters.categoryId
                          : "",
                      loanKind:
                        draftFilters.activityKind === "loan" ||
                        draftFilters.activityKind === "all"
                          ? draftFilters.loanKind
                          : ("all" as LoanKindFilter),
                      loanDirection:
                        draftFilters.activityKind === "loan" ||
                        draftFilters.activityKind === "all"
                          ? draftFilters.loanDirection
                          : ("all" as LoanDirectionFilter),
                    };
                    setFilters(normalizedFilters);
                    onPageChange(0);
                    setFilterOpen(false);
                  }}
                  className="min-h-11 min-w-0 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50 sm:flex-none"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
