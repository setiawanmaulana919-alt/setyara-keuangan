"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTransfer,
  saveTransaction,
} from "@/features/transactions/api/transactions-api";
import { listAccounts } from "@/features/wallets/api/wallets-api";
import { listCategories } from "@/features/transactions/api/categories-api";
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
        listCategories(),
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
            (category) => category.transactionType === "expense",
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
      categories.filter(
        (category) => category.transactionType === selectedType,
      ),
    [categories, selectedType],
  );

  function selectType(nextType: QuickAddType) {
    setSelectedType(nextType);
    if (nextType !== "transfer") {
      setCategoryId(
        categories.find((category) => category.transactionType === nextType)
          ?.id || "",
      );
    }
    setError("");
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
      setError(
        reason instanceof Error ? reason.message : "Data gagal disimpan.",
      );
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
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-[30px] border border-white/70 bg-[#f8fafc] p-5 shadow-2xl sm:max-w-xl sm:rounded-[30px] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Quick add · Pribadi
            </p>
            <h2
              id="quick-add-title"
              className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
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

        <div className="mt-6 grid grid-cols-3 gap-2">
          {typeOptions.map((option) => {
            const active = selectedType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => selectType(option.value)}
                className={`rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-blue-200"
                }`}
                aria-pressed={active}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {option.icon}
                </span>
                <span className="mt-3 block text-sm font-semibold text-slate-900">
                  {option.label}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>

        <form
          onSubmit={submit}
          className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
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
                className="min-w-0 text-lg font-semibold tabular-nums"
                placeholder="0"
              />
            </div>
          </label>

          {selectedType === "transfer" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="label">
                Dari akun
                <DropdownField
                  required
                  value={fromAccountId}
                  onChange={setFromAccountId}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </DropdownField>
              </label>
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
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="label">
                Akun
                <DropdownField
                  required
                  value={accountId}
                  onChange={setAccountId}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </DropdownField>
              </label>
              <label className="label">
                Kategori
                <DropdownField
                  required
                  value={categoryId}
                  onChange={setCategoryId}
                >
                  {visibleCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </DropdownField>
              </label>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              (selectedType !== "transfer" && !visibleCategories.length)
            }
            className="mt-6 min-h-12 w-full rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
