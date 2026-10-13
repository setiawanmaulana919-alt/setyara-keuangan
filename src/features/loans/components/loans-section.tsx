"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionModal } from "@/components/ui/action-modal";
import { Snackbar } from "@/components/ui/snackbar";
import { DateField } from "@/components/ui/date-field";
import { DropdownField } from "@/components/ui/dropdown-field";
import { formatNumberInput, parseNumberInput } from "@/lib/format-number";
import { getRequestId, renewRequestId } from "@/lib/request-id";
import { SwipeableCard } from "@/components/ui/swipeable-card";
import {
  createLoanRecord,
  deleteLoanRecord,
  listLoanRecords,
  recordLoanRepayment,
  updateLoanRecord,
} from "@/features/loans/api/loans-api";
import type { LoanDirection, LoanRecord } from "@/features/loans/types";
import type { Account } from "@/types/data-model";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const today = () => new Date().toISOString().slice(0, 10);

export function LoansSection({
  accounts,
  onChanged,
}: {
  accounts: Account[];
  onChanged: () => Promise<void>;
}) {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [activeLoanIndexes, setActiveLoanIndexes] = useState<
    Record<LoanDirection, number>
  >({ receivable: 0, payable: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);
  const [deletingLoan, setDeletingLoan] = useState<LoanRecord | null>(null);
  const [direction, setDirection] = useState<LoanDirection>("receivable");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [repaying, setRepaying] = useState<LoanRecord | null>(null);
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [repaymentAccountId, setRepaymentAccountId] = useState("");
  const [repaymentDate, setRepaymentDate] = useState(today);
  const [repaymentNotes, setRepaymentNotes] = useState("");
  const [loanRequestId, setLoanRequestId] = useState(() =>
    getRequestId("keuangan.loan-create-request-id"),
  );
  const [repaymentRequestId, setRepaymentRequestId] = useState(() =>
    getRequestId("keuangan.loan-repayment-request-id"),
  );

  const refresh = useCallback(async () => {
    setLoans(await listLoanRecords());
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(() => refresh())
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Data piutang dan utang gagal dimuat.",
        );
      })
      .finally(() => setLoading(false));
    const handleCloudUpdate = () => {
      void refresh().catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Data piutang dan utang gagal diperbarui.",
        );
      });
    };
    window.addEventListener("cloud-sync-updated", handleCloudUpdate);
    return () =>
      window.removeEventListener("cloud-sync-updated", handleCloudUpdate);
  }, [refresh]);

  function resetCreateForm() {
    setFormOpen(false);
    setEditingLoan(null);
    setDirection("receivable");
    setCounterpartyName("");
    setPrincipalAmount("");
    setAccountId("");
    setIssueDate(today());
    setDueDate("");
    setNotes("");
  }

  async function submitLoan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const input = {
        direction,
        counterpartyName,
        principalAmount: parseNumberInput(principalAmount),
        accountId,
        issueDate,
        dueDate: dueDate || undefined,
        notes,
      };
      if (editingLoan) {
        await updateLoanRecord({ loanId: editingLoan.id, ...input });
      } else {
        await createLoanRecord({ ...input, requestId: loanRequestId });
        setLoanRequestId(renewRequestId("keuangan.loan-create-request-id"));
      }
      const wasEditing = Boolean(editingLoan);
      resetCreateForm();
      setMessage(
        wasEditing
          ? "Catatan pinjaman berhasil diperbarui."
          : direction === "receivable"
            ? "Piutang dicatat dan saldo dompet diperbarui."
            : "Utang dicatat dan saldo dompet diperbarui.",
      );
      try {
        await Promise.all([refresh(), onChanged()]);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? `Pinjaman tersimpan, tetapi tampilan saldo gagal diperbarui: ${reason.message}`
            : "Pinjaman tersimpan, tetapi tampilan saldo gagal diperbarui.",
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Piutang atau utang gagal disimpan.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitRepayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!repaying) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await recordLoanRepayment({
        requestId: repaymentRequestId,
        loanId: repaying.id,
        accountId: repaymentAccountId,
        amount: parseNumberInput(repaymentAmount),
        repaymentDate,
        notes: repaymentNotes,
      });
      setRepaymentRequestId(
        renewRequestId("keuangan.loan-repayment-request-id"),
      );
      setRepaying(null);
      setRepaymentAmount("");
      setRepaymentAccountId("");
      setRepaymentDate(today());
      setRepaymentNotes("");
      setMessage("Pembayaran dicatat dan saldo dompet diperbarui.");
      try {
        await Promise.all([refresh(), onChanged()]);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? `Pembayaran tersimpan, tetapi tampilan saldo gagal diperbarui: ${reason.message}`
            : "Pembayaran tersimpan, tetapi tampilan saldo gagal diperbarui.",
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Pembayaran gagal dicatat.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openRepayment(loan: LoanRecord) {
    setRepaying(loan);
  }

  function openEditLoan(loan: LoanRecord) {
    setEditingLoan(loan);
    setDirection(loan.direction);
    setCounterpartyName(loan.counterpartyName);
    setPrincipalAmount(formatNumberInput(String(loan.principalAmount)));
    setAccountId(
      accounts.some((account) => account.id === loan.accountId)
        ? loan.accountId
        : "",
    );
    setIssueDate(loan.issueDate);
    setDueDate(loan.dueDate ?? "");
    setNotes(loan.notes ?? "");
    setFormOpen(true);
  }

  async function submitDeleteLoan() {
    if (!deletingLoan) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await deleteLoanRecord(deletingLoan.id);
      setDeletingLoan(null);
      setMessage("Catatan pinjaman dan riwayat pembayarannya telah dihapus.");
      try {
        await Promise.all([refresh(), onChanged()]);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? `Catatan terhapus, tetapi tampilan saldo gagal diperbarui: ${reason.message}`
            : "Catatan terhapus, tetapi tampilan saldo gagal diperbarui.",
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Catatan pinjaman gagal dihapus.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderLoanCards(direction: LoanDirection, title: string) {
    const items = loans.filter((loan) => loan.direction === direction);
    const totalRemaining = items.reduce(
      (total, item) => total + item.remainingAmount,
      0,
    );
    const activeIndex = Math.min(
      activeLoanIndexes[direction],
      Math.max(items.length - 1, 0),
    );
    const loan = items[activeIndex];
    const progress = loan
      ? loan.principalAmount > 0
        ? Math.round(
            ((loan.principalAmount - loan.remainingAmount) /
              loan.principalAmount) *
              100,
          )
        : 0
      : 0;
    const isReceivable = direction === "receivable";
    const theme = isReceivable
      ? {
          accent: "text-emerald-700",
          iconBg: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
          iconBorder: "border-emerald-100",
          progress: "bg-emerald-500",
        }
      : {
          accent: "text-amber-700",
          iconBg: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
          iconBorder: "border-amber-100",
          progress: "bg-amber-500",
        };

    return (
      <section className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-[0_2px_10px_rgb(15_23_42/0.025)] sm:p-5">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${theme.iconBorder} ${theme.iconBg}`}
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isReceivable ? (
                  <>
                    <path d="M7 7l10 10" />
                    <path d="M8 17h9V8" />
                  </>
                ) : (
                  <>
                    <path d="M7 17 17 7" />
                    <path d="M7 8v9h9" />
                  </>
                )}
              </svg>
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-900">
                {title}
              </h3>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                {isReceivable ? "Akan diterima" : "Perlu dibayar"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium text-slate-400">Total sisa</p>
            <p
              className={`mt-0.5 text-sm font-bold tabular-nums ${theme.accent}`}
            >
              {currency.format(totalRemaining)}
            </p>
          </div>
        </div>

        <nav
          aria-label={`Navigasi ${title.toLocaleLowerCase()}`}
          className="mt-3 flex h-8 shrink-0 items-center justify-between gap-3"
        >
          <span aria-live="polite" className="text-xs text-slate-400">
            {items.length
              ? `${activeIndex + 1} dari ${items.length}`
              : "0 catatan"}
          </span>
          {items.length > 1 && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() =>
                  setActiveLoanIndexes((current) => ({
                    ...current,
                    [direction]: Math.max(activeIndex - 1, 0),
                  }))
                }
                disabled={activeIndex === 0}
                aria-label={`${title}: sebelumnya`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveLoanIndexes((current) => ({
                    ...current,
                    [direction]: Math.min(activeIndex + 1, items.length - 1),
                  }))
                }
                disabled={activeIndex >= items.length - 1}
                aria-label={`${title}: berikutnya`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>
            </div>
          )}
        </nav>

        <div className="mt-3 flex flex-1">
          {loan ? (
            <SwipeableCard
              as="article"
              key={loan.id}
              onSwipeLeft={() =>
                setActiveLoanIndexes((current) => ({
                  ...current,
                  [direction]: Math.min(activeIndex + 1, items.length - 1),
                }))
              }
              onSwipeRight={() =>
                setActiveLoanIndexes((current) => ({
                  ...current,
                  [direction]: Math.max(activeIndex - 1, 0),
                }))
              }
              className="flex min-h-[15rem] w-full touch-pan-y flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {isReceivable ? "Peminjam" : "Pemberi pinjaman"}
                  </p>
                  <h4 className="truncate text-sm font-semibold text-slate-800">
                    {loan.counterpartyName}
                  </h4>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {loan.accountName} · {loan.issueDate}
                    {loan.dueDate ? ` · Jatuh tempo ${loan.dueDate}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    loan.remainingAmount === 0
                      ? "bg-slate-100 text-slate-600"
                      : isReceivable
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {loan.remainingAmount === 0 ? "Lunas" : "Berjalan"}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-500">
                    Sisa {isReceivable ? "piutang" : "utang"}
                  </p>
                  <p
                    className={`mt-1 truncate text-xl font-bold tracking-tight tabular-nums ${theme.accent}`}
                  >
                    {currency.format(loan.remainingAmount)}
                  </p>
                </div>
                <p className="shrink-0 pb-1 text-right text-[10px] text-slate-400">
                  {loan.repaymentCount} kali dibayar
                </p>
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                {currency.format(loan.principalAmount - loan.remainingAmount)}{" "}
                dari {currency.format(loan.principalAmount)} dibayar
              </p>
              <div className="mt-2">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-label="Progres pembayaran"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div
                    className={`h-full rounded-full transition-[width] ${theme.progress}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-auto border-t border-slate-100 pt-3">
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                  <span className="shrink-0 text-[10px] font-medium text-slate-400">
                    {loan.repaymentCount} kali pembayaran
                  </span>
                  {loan.notes && (
                    <p className="min-w-0 truncate text-right text-[10px] text-slate-400">
                      {loan.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openRepayment(loan)}
                  disabled={loan.remainingAmount === 0 || accounts.length === 0}
                  className="min-h-10 w-full rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {loan.remainingAmount === 0
                    ? "Lunas"
                    : accounts.length === 0
                      ? "Tambah dompet"
                      : "Catat pembayaran"}
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openEditLoan(loan)}
                    className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingLoan(loan)}
                    className="min-h-9 rounded-lg border border-rose-100 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </SwipeableCard>
          ) : (
            <div className="flex min-h-[15rem] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Belum ada {title.toLocaleLowerCase()}
              </p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                Catatan yang Anda tambahkan akan tampil di sini.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">
              ⇄
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Piutang &amp; utang
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
                Pantau uang yang akan diterima dan dibayarkan. Pencairan serta
                cicilan memperbarui saldo dompet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={accounts.length === 0}
            className="min-h-11 w-full shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            + Catat pinjaman
          </button>
        </div>

        {accounts.length === 0 && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-800">
            Tambahkan dompet pribadi aktif sebelum mencatat pinjaman.
          </p>
        )}

        {loading ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-[22rem] animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 grid items-stretch gap-6 lg:grid-cols-2">
            {renderLoanCards("receivable", "Piutang")}
            {renderLoanCards("payable", "Utang")}
          </div>
        )}
      </section>

      {formOpen && (
        <ActionModal
          title={editingLoan ? "Edit catatan pinjaman" : "Catat pinjaman"}
          description={
            editingLoan
              ? "Perbarui detail pinjaman. Saldo dompet akan dihitung ulang; total pokok tidak boleh lebih kecil dari pembayaran yang sudah dicatat."
              : "Pencairan akan langsung memperbarui saldo dompet. Pokok pinjaman tidak masuk ke laporan pemasukan atau pengeluaran."
          }
          submitLabel={editingLoan ? "Simpan perubahan" : "Simpan pinjaman"}
          submitting={saving}
          onClose={resetCreateForm}
          onSubmit={(event) => void submitLoan(event)}
        >
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-700">
              Jenis pencatatan
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "receivable",
                    title: "Piutang",
                    description: "Saya meminjamkan uang",
                    activeClass:
                      "border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100",
                  },
                  {
                    value: "payable",
                    title: "Utang",
                    description: "Saya meminjam uang",
                    activeClass:
                      "border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-100",
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDirection(option.value)}
                  aria-pressed={direction === option.value}
                  className={`min-h-16 rounded-xl border px-3 py-2 text-left transition ${
                    direction === option.value
                      ? option.activeClass
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {option.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 opacity-75">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">
              Nama orang
              <input
                required
                maxLength={100}
                value={counterpartyName}
                onChange={(event) => setCounterpartyName(event.target.value)}
                className="field"
                placeholder="Nama orang"
              />
            </label>
            <label className="label">
              Jumlah pokok
              <div className="money-field mt-1">
                <span className="money-field-prefix">Rp</span>
                <input
                  required
                  inputMode="numeric"
                  value={principalAmount}
                  onChange={(event) =>
                    setPrincipalAmount(formatNumberInput(event.target.value))
                  }
                  className="text-base font-semibold tabular-nums"
                  placeholder="0"
                  aria-label="Jumlah pokok dalam rupiah"
                />
              </div>
            </label>
            <label className="label">
              Dompet
              <DropdownField required value={accountId} onChange={setAccountId}>
                <option value="">Pilih dompet</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </DropdownField>
            </label>
            <label className="label">
              Tanggal pencairan
              <DateField
                required
                value={issueDate}
                onChange={setIssueDate}
                aria-label="Tanggal pencairan"
              />
            </label>
            <label className="label sm:col-span-2">
              Jatuh tempo{" "}
              <span className="font-normal text-slate-400">(opsional)</span>
              <DateField
                min={issueDate}
                value={dueDate}
                onChange={setDueDate}
                aria-label="Jatuh tempo"
              />
            </label>
          </div>
          <label className="label">
            Catatan{" "}
            <span className="font-normal text-slate-400">(opsional)</span>
            <textarea
              maxLength={500}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="field min-h-24 resize-y"
              placeholder="Tambahkan detail atau kesepakatan pinjaman"
            />
          </label>
        </ActionModal>
      )}

      {repaying && (
        <ActionModal
          title="Catat pembayaran"
          description={`Sisa ${repaying.direction === "receivable" ? "piutang" : "utang"}: ${currency.format(repaying.remainingAmount)}.`}
          submitLabel="Simpan pembayaran"
          submitting={saving}
          onClose={() => setRepaying(null)}
          onSubmit={(event) => void submitRepayment(event)}
        >
          <label className="label">
            Jumlah pembayaran
            <div className="money-field mt-1">
              <span className="money-field-prefix">Rp</span>
              <input
                required
                inputMode="numeric"
                value={repaymentAmount}
                onChange={(event) =>
                  setRepaymentAmount(formatNumberInput(event.target.value))
                }
                className="text-base font-semibold tabular-nums"
                placeholder="0"
                aria-label="Jumlah pembayaran dalam rupiah"
              />
            </div>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">
              Dompet
              <DropdownField
                required
                value={repaymentAccountId}
                onChange={setRepaymentAccountId}
              >
                <option value="">Pilih dompet</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </DropdownField>
            </label>
            <label className="label">
              Tanggal pembayaran
              <DateField
                required
                value={repaymentDate}
                onChange={setRepaymentDate}
                aria-label="Tanggal pembayaran"
              />
            </label>
          </div>
          <label className="label">
            Catatan{" "}
            <span className="font-normal text-slate-400">(opsional)</span>
            <textarea
              maxLength={500}
              value={repaymentNotes}
              onChange={(event) => setRepaymentNotes(event.target.value)}
              className="field min-h-24 resize-y"
              placeholder="Tambahkan detail pembayaran (opsional)"
            />
          </label>
        </ActionModal>
      )}

      {deletingLoan && (
        <ActionModal
          title={`Hapus ${deletingLoan.direction === "receivable" ? "piutang" : "utang"}?`}
          description={`Catatan untuk ${deletingLoan.counterpartyName} akan dihapus permanen.`}
          submitLabel="Hapus permanen"
          destructive
          submitting={saving}
          onClose={() => setDeletingLoan(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void submitDeleteLoan();
          }}
        >
          <p>
            Catatan pinjaman dan riwayat pembayarannya
            {deletingLoan.repaymentCount > 0
              ? ` (${deletingLoan.repaymentCount} pembayaran) `
              : " "}
            akan dihapus permanen. Saldo dompet dan total kekayaan akan dihitung
            ulang. Tindakan ini tidak dapat dibatalkan.
          </p>
        </ActionModal>
      )}

      {(message || error) && (
        <Snackbar
          message={error || message}
          tone={error ? "error" : "success"}
          onClose={() => {
            setError("");
            setMessage("");
          }}
        />
      )}
    </>
  );
}
