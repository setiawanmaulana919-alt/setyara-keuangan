"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTransfer,
  saveTransaction,
} from "@/features/transactions/api/transactions-api";
import {
  formatAccountSpendError,
  listAccounts,
} from "@/features/wallets/api/wallets-api";
import {
  isDefaultCategory,
  isGoalCategoryName,
  isOtherCategoryName,
  listCategories,
} from "@/features/transactions/api/categories-api";
import { ensureFinanceDefaults } from "@/features/finance/api/initialization-api";
import type {
  Account,
  Category,
  FinancialTransaction,
  TransactionType,
} from "@/types/data-model";
import { formatNumberInput, parseNumberInput } from "@/lib/format-number";
import { getRequestId, renewRequestId } from "@/lib/request-id";
import { DateField } from "@/components/ui/date-field";
import { DropdownField } from "@/components/ui/dropdown-field";
import { Snackbar } from "@/components/ui/snackbar";

type QuickAddType = TransactionType | "transfer";

const typeOptions: Array<{
  value: QuickAddType;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: "expense",
    label: "Pengeluaran",
    description: "Catat uang yang digunakan",
    icon: "−",
  },
  {
    value: "income",
    label: "Pemasukan",
    description: "Catat uang yang diterima",
    icon: "+",
  },
  {
    value: "transfer",
    label: "Transfer",
    description: "Pindahkan antar akun",
    icon: "↔",
  },
];

export function QuickAddModal({
  open,
  onClose,
  onSaved,
  editingTransaction,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  editingTransaction?: FinancialTransaction | null;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedType, setSelectedType] = useState<QuickAddType>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const optionsRequestRef = useRef<Promise<void> | null>(null);
  const optionsLoadFailedRef = useRef(false);
  const [requestId, setRequestId] = useState(() =>
    getRequestId("keuangan.quick-add-request-id"),
  );

  useEffect(() => {
    if (open && !date) {
      const timer = window.setTimeout(() => {
        setDate(new Date().toISOString().slice(0, 10));
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [date, open]);

  useEffect(() => {
    if (!open || !editingTransaction) return;
    const timer = window.setTimeout(() => {
      setSelectedType(editingTransaction.transactionType);
      setAmount(formatNumberInput(String(editingTransaction.amount)));
      setAccountId(editingTransaction.accountId);
      setCategoryId(editingTransaction.categoryId);
      setDate(editingTransaction.transactionDate);
      setNote(editingTransaction.note ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editingTransaction, open]);

  const loadOptions = useCallback((): Promise<void> => {
    if (optionsRequestRef.current) return optionsRequestRef.current;
    const request = (async () => {
      await ensureFinanceDefaults();
      const [nextAccounts, nextCategories] = await Promise.all([
        listAccounts(),
        listCategories(undefined, true),
      ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setAccountId((current) => current || nextAccounts[0]?.id || "");
      setFromAccountId((current) => current || nextAccounts[0]?.id || "");
      setToAccountId((current) => current || nextAccounts[1]?.id || "");
      setCategoryId(
        (current) =>
          current ||
          nextCategories.find(
            (category) =>
              category.transactionType === "expense" &&
              category.familyId === nextAccounts[0]?.familyId &&
              !isGoalCategoryName(category.name) &&
              !category.archivedAt,
          )?.id ||
          "",
      );
    })();
    const trackedRequest = request.finally(() => {
      if (optionsRequestRef.current === trackedRequest) {
        optionsRequestRef.current = null;
      }
    });
    optionsRequestRef.current = trackedRequest;
    return trackedRequest;
  }, []);

  const refreshOptions = useCallback(async () => {
    const recoveringFromOptionsError = optionsLoadFailedRef.current;
    try {
      await loadOptions();
      optionsLoadFailedRef.current = false;
      if (recoveringFromOptionsError) setError("");
    } catch (reason: unknown) {
      optionsLoadFailedRef.current = true;
      setError(
        reason instanceof Error
          ? reason.message
          : "Gagal memuat pilihan transaksi.",
      );
    }
  }, [loadOptions]);

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(refreshOptions);
    window.addEventListener("online", refreshOptions);
    return () => window.removeEventListener("online", refreshOptions);
  }, [open, refreshOptions]);

  const visibleCategories = useMemo(
    () =>
      categories
        .filter(
          (category) =>
            category.transactionType === selectedType &&
            category.familyId ===
              accounts.find((account) => account.id === accountId)?.familyId &&
            !isGoalCategoryName(category.name) &&
            (isDefaultCategory(category.name, category.transactionType) ||
              category.id === editingTransaction?.categoryId) &&
            (!category.archivedAt ||
              category.id === editingTransaction?.categoryId),
        )
        .sort((left, right) => {
          const leftIsOther = isOtherCategoryName(left.name);
          const rightIsOther = isOtherCategoryName(right.name);
          if (leftIsOther !== rightIsOther) return leftIsOther ? 1 : -1;
          return left.name.localeCompare(right.name, "id-ID");
        }),
    [
      accountId,
      accounts,
      categories,
      editingTransaction?.categoryId,
      selectedType,
    ],
  );
  function selectType(nextType: QuickAddType) {
    setSelectedType(nextType);
    if (nextType !== "transfer") {
      const selectedFamilyId = accounts.find(
        (account) => account.id === accountId,
      )?.familyId;
      setCategoryId(
        categories.find(
          (category) =>
            category.transactionType === nextType &&
            category.familyId === selectedFamilyId &&
            !isGoalCategoryName(category.name) &&
            isDefaultCategory(category.name, category.transactionType) &&
            !category.archivedAt,
        )?.id || "",
      );
    }
    setError("");
  }

  function selectAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
    const selectedFamilyId = accounts.find(
      (account) => account.id === nextAccountId,
    )?.familyId;
    const categoryMatchesAccount = categories.some(
      (category) =>
        category.id === categoryId &&
        category.familyId === selectedFamilyId &&
        category.transactionType === selectedType &&
        !category.archivedAt &&
        !isGoalCategoryName(category.name) &&
        isDefaultCategory(category.name, category.transactionType),
    );
    if (categoryMatchesAccount) return;
    setCategoryId(
      categories.find(
        (category) =>
          category.familyId === selectedFamilyId &&
          category.transactionType === selectedType &&
          !category.archivedAt &&
          !isGoalCategoryName(category.name) &&
          isDefaultCategory(category.name, category.transactionType),
      )?.id ?? "",
    );
  }

  function resetAndClose() {
    if (submitting) return;
    setError("");
    setAmount("");
    setNote("");
    setSelectedType("expense");
    setDate("");
    onClose();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (selectedType === "transfer") {
        await createTransfer({
          fromAccountId,
          toAccountId,
          amount: parseNumberInput(amount),
          transferDate: date,
          note: note.trim() || undefined,
          requestId,
        });
      } else {
        await saveTransaction(
          {
            accountId,
            categoryId,
            transactionType: selectedType,
            amount: parseNumberInput(amount),
            transactionDate: date,
            note: note.trim() || undefined,
          },
          editingTransaction?.id,
          requestId,
        );
      }
      onSaved?.();
      setError("");
      setAmount("");
      setNote("");
      setSelectedType("expense");
      setDate("");
      setRequestId(renewRequestId("keuangan.quick-add-request-id"));
      onClose();
    } catch (reason) {
      setError(formatAccountSpendError(reason));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) resetAndClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-[26px] border border-white/70 bg-[#f8fafc] p-4 shadow-2xl sm:max-w-xl sm:rounded-[30px] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Quick add · Pribadi
            </p>
            <h2
              id="quick-add-title"
              className="mt-1.5 text-xl font-bold tracking-tight text-slate-950 sm:mt-2 sm:text-2xl"
            >
              {editingTransaction ? "Edit transaksi" : "Tambah transaksi"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pilih jenis transaksi yang ingin dicatat.
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl leading-none text-slate-500 shadow-sm hover:bg-slate-100"
            aria-label="Tutup tambah transaksi"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:mt-6 sm:gap-2">
          {typeOptions.map((option) => {
            const active = selectedType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => selectType(option.value)}
                className={`rounded-xl border p-2 text-left transition sm:rounded-2xl sm:p-3 ${
                  active
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-blue-200"
                }`}
                aria-pressed={active}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold sm:h-9 sm:w-9 sm:rounded-xl sm:text-lg ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {option.icon}
                </span>
                <span className="mt-2 block text-xs font-semibold text-slate-900 sm:mt-3 sm:text-sm">
                  {option.label}
                </span>
                <span className="mt-1 hidden text-[11px] leading-4 text-slate-500 sm:block">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>

        <form
          onSubmit={submit}
          className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:mt-6 sm:p-5"
        >
          <label className="label">
            Nominal
            <div className="money-field mt-1">
              <span className="money-field-prefix">Rp</span>
              <input
                required
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(event) =>
                  setAmount(formatNumberInput(event.target.value))
                }
                className="min-w-0 text-base font-semibold tabular-nums sm:text-lg"
                placeholder="0"
              />
            </div>
          </label>

          {selectedType === "transfer" ? (
            <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 sm:grid-cols-2">
              <div>
                <span className="label">Dari akun</span>
                <DropdownField
                  required
                  value={fromAccountId}
                  aria-label="Dari akun"
                  onChange={setFromAccountId}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </DropdownField>
              </div>
              <label className="label">
                Ke akun
                <DropdownField
                  required
                  value={toAccountId}
                  onChange={setToAccountId}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </DropdownField>
              </label>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 sm:grid-cols-2">
              <div>
                <span className="label">Akun</span>
                <DropdownField
                  required
                  value={accountId}
                  aria-label="Akun"
                  onChange={selectAccount}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </DropdownField>
              </div>
              <div>
                <span className="label">Kategori</span>
                <DropdownField
                  required
                  aria-label="Kategori transaksi"
                  value={categoryId}
                  onChange={setCategoryId}
                >
                  {visibleCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </DropdownField>
              </div>
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 sm:grid-cols-2">
            <label className="label">
              Tanggal
              <DateField
                required
                value={date}
                onChange={setDate}
                aria-label="Tanggal transaksi"
              />
            </label>
            <label className="label">
              Catatan{" "}
              <span className="font-normal text-slate-400">(opsional)</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="field"
                placeholder={
                  selectedType === "transfer"
                    ? "Contoh: isi saldo e-wallet"
                    : "Contoh: makan siang"
                }
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              !accounts.length ||
              (selectedType !== "transfer" && !categoryId)
            }
            className="mt-5 min-h-11 w-full rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-6 sm:min-h-12 sm:rounded-2xl"
          >
            {submitting
              ? "Menyimpan..."
              : `${editingTransaction ? "Simpan perubahan" : `Simpan ${selectedType === "transfer" ? "transfer" : "transaksi"}`}`}
          </button>
        </form>
      </div>
      {error && (
        <Snackbar message={error} tone="error" onClose={() => setError("")} />
      )}
    </div>
  );
}
