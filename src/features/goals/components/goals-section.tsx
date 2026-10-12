"use client";

import { useMemo, useState } from "react";
import type { Family } from "@/features/family/api/family-api";
import type { Account } from "@/types/data-model";
import {
  addGoalContribution,
  createSavingsGoal,
  deleteSavingsGoal,
  reduceGoalContribution,
  updateSavingsGoal,
} from "@/features/goals/api/goals-api";
import type { GoalProgress } from "@/features/goals/types";
import { ActionModal } from "@/components/ui/action-modal";
import { Snackbar } from "@/components/ui/snackbar";
import { DateField } from "@/components/ui/date-field";
import { DropdownField } from "@/components/ui/dropdown-field";
import { formatNumberInput, parseNumberInput } from "@/lib/format-number";
import { getRequestId, renewRequestId } from "@/lib/request-id";

type GoalScope = "personal" | "family";

function getOperationError(reason: unknown, fallback: string): string {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "object" && reason !== null) {
    const error = reason as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const parts = [error.message, error.details, error.hint].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (parts.length > 0) return parts.join(" ");
  }
  return fallback;
}

export function GoalsSection({
  goals,
  families,
  accounts,
  currency,
  onChanged,
}: {
  goals: GoalProgress[];
  families: Family[];
  accounts: Account[];
  currency: Intl.NumberFormat;
  onChanged: () => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalProgress | null>(null);
  const [contributing, setContributing] = useState<GoalProgress | null>(null);
  const [deleting, setDeleting] = useState<GoalProgress | null>(null);
  const [scope, setScope] = useState<GoalScope>("personal");
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [mode, setMode] = useState<"add" | "reduce">("add");
  const [contributionRequestId, setContributionRequestId] = useState(() =>
    getRequestId("keuangan.goal-contribution-request-id"),
  );
  const [contributionDate, setContributionDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function resetForm() {
    setFormOpen(false);
    setEditing(null);
    setScope("personal");
    setName("");
    setTargetAmount("");
    setTargetDate("");
    setFamilyId("");
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(item: GoalProgress) {
    setEditing(item);
    setScope(item.goal.scopeType);
    setName(item.goal.name);
    setTargetAmount(formatNumberInput(String(item.goal.targetAmount)));
    setTargetDate(item.goal.targetDate ?? "");
    setFamilyId(item.goal.familyId ?? "");
    setFormOpen(true);
  }

  async function submitGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = {
        name,
        targetAmount: parseNumberInput(targetAmount),
        targetDate: targetDate || undefined,
      };
      if (editing) {
        await updateSavingsGoal(editing.goal.id, input);
        setMessage("Target berhasil diperbarui.");
      } else {
        await createSavingsGoal({ ...input, scopeType: scope, familyId });
        setMessage("Target berhasil ditambahkan.");
      }
      resetForm();
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Target gagal disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contributing) return;
    setBusy(true);
    setError("");
    try {
      const value = parseNumberInput(amount);
      if (mode === "add") {
        await addGoalContribution({
          goalId: contributing.goal.id,
          amount: value,
          accountId,
          contributionDate,
          requestId: contributionRequestId,
        });
        setMessage("Progres target berhasil ditambahkan.");
      } else {
        await reduceGoalContribution(
          contributing.goal.id,
          value,
          accountId,
          contributionRequestId,
          contributionDate,
        );
        setMessage("Progres target berhasil dikurangi.");
      }

      onChanged();
      setContributing(null);
      setAmount("");
      setAccountId("");
      setMode("add");
      setContributionRequestId(
        renewRequestId("keuangan.goal-contribution-request-id"),
      );
      setContributionDate(new Date().toISOString().slice(0, 10));
    } catch (reason) {
      setError(getOperationError(reason, "Progres target gagal diubah."));
    } finally {
      setBusy(false);
    }
  }

  function openContribution(item: GoalProgress) {
    setContributing(item);
  }

  async function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await deleteSavingsGoal(deleting.goal.id);
      setDeleting(null);
      setMessage("Target berhasil dihapus.");
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Target gagal dihapus.",
      );
    } finally {
      setBusy(false);
    }
  }

  const { personalGoals, familyGoals } = useMemo(
    () => ({
      personalGoals: goals.filter((item) => item.goal.scopeType === "personal"),
      familyGoals: goals.filter((item) => item.goal.scopeType === "family"),
    }),
    [goals],
  );

  return (
    <>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Target keuangan
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pantau progres target mandiri dan keluarga dalam satu tempat.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Tambah target
          </button>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <GoalGroup
            title="Target mandiri"
            items={personalGoals}
            currency={currency}
            onEdit={openEdit}
            onContribute={openContribution}
            onDelete={setDeleting}
          />
          <GoalGroup
            title="Target keluarga"
            items={familyGoals}
            currency={currency}
            onEdit={openEdit}
            onContribute={openContribution}
            onDelete={setDeleting}
          />
        </div>
      </section>

      {formOpen && (
        <ActionModal
          title={editing ? "Edit target" : "Tambah target"}
          description="Tentukan tujuan dan nominal yang ingin dicapai."
          submitLabel={editing ? "Simpan perubahan" : "Simpan target"}
          submitting={busy}
          onClose={resetForm}
          onSubmit={submitGoal}
        >
          {!editing && (
            <label className="label">
              Jenis target
              <DropdownField
                value={scope}
                onChange={(value) => setScope(value as GoalScope)}
              >
                <option value="personal">Target mandiri</option>
                <option value="family" disabled={families.length === 0}>
                  Target keluarga
                </option>
              </DropdownField>
            </label>
          )}
          {scope === "family" && !editing && (
            <label className="label">
              Keluarga
              <DropdownField required value={familyId} onChange={setFamilyId}>
                <option value="">Pilih keluarga</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name}
                  </option>
                ))}
              </DropdownField>
              <span className="mt-1 block text-xs text-slate-500">
                {mode === "add"
                  ? "Alur dana: sumber dana → target ini"
                  : "Alur dana: target ini → sumber dana"}
              </span>
            </label>
          )}
          <label className="label">
            Nama target
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
              placeholder="Dana liburan"
            />
          </label>
          <label className="label">
            Nominal target
            <div className="money-field mt-1">
              <span className="money-field-prefix">Rp</span>
              <input
                required
                value={targetAmount}
                onChange={(event) =>
                  setTargetAmount(formatNumberInput(event.target.value))
                }
                className="min-w-0"
                placeholder="0"
              />
            </div>
          </label>
          <label className="label">
            Batas waktu{" "}
            <span className="font-normal text-slate-400">(opsional)</span>
            <DateField
              value={targetDate}
              onChange={setTargetDate}
              aria-label="Batas waktu target"
            />
          </label>
        </ActionModal>
      )}

      {contributing && (
        <ActionModal
          title="Ubah progres target"
          description={`${contributing.goal.name} · Terkumpul ${currency.format(contributing.saved)}`}
          submitLabel={mode === "add" ? "Tambah progres" : "Kurangi progres"}
          destructive={mode === "reduce"}
          submitting={busy}
          onClose={() => {
            setContributing(null);
          }}
          onSubmit={submitContribution}
        >
          <label className="label">
            Aksi
            <DropdownField
              value={mode}
              onChange={(value) => setMode(value as "add" | "reduce")}
            >
              <option value="add">Tambah progres</option>
              <option value="reduce">Kurangi progres</option>
            </DropdownField>
          </label>
          <label className="label">
            {mode === "add" ? "Uang diambil dari" : "Uang dikembalikan ke"}
            <DropdownField required value={accountId} onChange={setAccountId}>
              <option value="">
                {mode === "add" ? "Pilih sumber dana" : "Pilih tujuan dana"}
              </option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </DropdownField>
          </label>
          <label className="label">
            Nominal
            <input
              required
              value={amount}
              onChange={(event) =>
                setAmount(formatNumberInput(event.target.value))
              }
              className="field tabular-nums"
              placeholder="0"
            />
          </label>
        </ActionModal>
      )}

      {deleting && (
        <ActionModal
          title="Hapus target?"
          description={`Target "${deleting.goal.name}", riwayat progres, dan transaksi terkait akan dihapus permanen.`}
          submitLabel="Hapus target"
          destructive
          submitting={busy}
          onClose={() => setDeleting(null)}
          onSubmit={confirmDelete}
        >
          <p>Tindakan ini tidak dapat dibatalkan.</p>
        </ActionModal>
      )}

      {(message || error) && (
        <Snackbar
          message={error || message}
          tone={error ? "error" : "success"}
          onClose={() => {
            setMessage("");
            setError("");
          }}
        />
      )}
    </>
  );
}

function GoalGroup({
  title,
  items,
  currency,
  onEdit,
  onContribute,
  onDelete,
}: {
  title: string;
  items: GoalProgress[];
  currency: Intl.NumberFormat;
  onEdit: (item: GoalProgress) => void;
  onContribute: (item: GoalProgress) => void;
  onDelete: (item: GoalProgress) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));
  const activeItem = items[activeIndex];

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {items.length
              ? `${activeIndex + 1} dari ${items.length}`
              : "0 target"}
          </span>
          {items.length > 1 && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSelectedIndex(Math.max(activeIndex - 1, 0))}
                disabled={activeIndex === 0}
                aria-label="Target sebelumnya"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-500 hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-500"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedIndex(Math.min(activeIndex + 1, items.length - 1))
                }
                disabled={activeIndex === items.length - 1}
                aria-label="Target berikutnya"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-500 hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-500"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Belum ada target.</p>
      ) : (
        <div className="mt-4 min-h-[13rem]">
          {activeItem && (
            <article
              key={activeItem.goal.id}
              className="flex min-h-[13rem] flex-col rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">
                    {activeItem.goal.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {currency.format(activeItem.saved)} dari{" "}
                    {currency.format(activeItem.goal.targetAmount)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-600">
                  {Math.round(activeItem.percentage)}%
                </span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${activeItem.percentage}%` }}
                />
              </div>
              <div className="mt-auto border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => onContribute(activeItem)}
                  className="min-h-10 w-full rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Ubah progres
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(activeItem)}
                    className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(activeItem)}
                    className="min-h-9 rounded-lg border border-rose-100 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
