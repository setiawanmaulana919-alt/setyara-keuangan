"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createFamily,
  inviteFamilyMember,
  createFamilyJoinCode,
  joinFamilyWithCode,
  leaveFamily,
  removeMember,
  updateMemberRole,
  type FamilyMember,
} from "@/features/family/api/family-api";
import { useFamilyOverview } from "@/features/family/hooks/use-family-overview";
import { AppShell } from "@/components/shared/app-shell";
import { ActionModal } from "@/components/ui/action-modal";
import { Snackbar } from "@/components/ui/snackbar";
import { DropdownField } from "@/components/ui/dropdown-field";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default function FamilyPage() {
  const {
    families,
    members,
    memberUsernames,
    userId,
    loading,
    error,
    setError,
    activeCodes,
    setActiveCodes,
    memberFinances,
    refresh,
  } = useFamilyOverview();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [invitingFamilyId, setInvitingFamilyId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [codeRole, setCodeRole] = useState<"editor" | "viewer">("viewer");
  const [deactivating, setDeactivating] = useState<FamilyMember | null>(null);
  const [deactivatingBusy, setDeactivatingBusy] = useState(false);
  const [leavingFamilyId, setLeavingFamilyId] = useState<string | null>(null);

  async function submitFamily(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setCreating(true);
    try {
      await createFamily(name);
      setName("");
      setMessage("Keluarga dibuat dan owner otomatis ditambahkan.");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Keluarga gagal dibuat.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function changeRole(member: FamilyMember, role: "editor" | "viewer") {
    try {
      await updateMemberRole(member.id, role);
      setMessage("Role anggota diperbarui.");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Role gagal diperbarui.",
      );
    }
  }

  async function deactivate(member: FamilyMember) {
    setDeactivatingBusy(true);
    try {
      await removeMember(member.id);
      setMessage("Akses anggota dicabut.");
      await refresh();
      setDeactivating(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Anggota gagal dinonaktifkan.",
      );
    } finally {
      setDeactivatingBusy(false);
    }
  }

  async function leave(familyId: string) {
    setLeavingFamilyId(familyId);
    setError("");
    try {
      await leaveFamily(familyId);
      setMessage("Anda berhasil keluar dari keluarga.");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Gagal keluar dari keluarga.",
      );
    } finally {
      setLeavingFamilyId(null);
    }
  }

  async function invite(familyId: string) {
    setError("");
    setMessage("");
    setInvitingFamilyId(familyId);
    try {
      await inviteFamilyMember(familyId, inviteEmail, inviteRole);
      setInviteEmail("");
      setMessage(
        "Undangan berhasil dikirim. Anggota akan muncul setelah akses aktif.",
      );
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Undangan gagal dikirim.",
      );
    } finally {
      setInvitingFamilyId(null);
    }
  }

  async function createJoinCode(familyId: string) {
    setError("");
    setMessage("");
    try {
      const result = await createFamilyJoinCode(familyId, codeRole);
      setActiveCodes((current) => ({
        ...current,
        [familyId]: {
          code: result.code,
          role: result.role,
          expiresAt: new Date(
            Date.now() + result.expiresInHours * 60 * 60 * 1000,
          ).toISOString(),
        },
      }));
      setMessage(
        `Kode gabung ${result.code} dibuat untuk role ${result.role}. Berlaku ${result.expiresInHours} jam.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Kode gabung gagal dibuat.",
      );
    }
  }

  async function joinWithCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setJoining(true);
    try {
      await joinFamilyWithCode(joinCode);
      setJoinCode("");
      setMessage("Berhasil bergabung ke keluarga.");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Gagal bergabung ke keluarga.",
      );
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-5">
        <p className="text-sm text-slate-500">Memuat data keluarga...</p>
      </main>
    );
  }

  if (error && !userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_16px_rgb(15_23_42/0.04)]">
          <h1 className="text-xl font-semibold">Koneksi cloud belum siap</h1>
          <p className="mt-2 text-sm text-rose-700">{error}</p>
          <Link href="/" className="mt-5 inline-block text-sm text-blue-600">
            Kembali ke dashboard
          </Link>
        </section>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-[0_4px_16px_rgb(15_23_42/0.04)]">
          <h1 className="text-xl font-semibold">Keuangan keluarga</h1>
          <p className="mt-2 text-sm text-slate-500">
            Login diperlukan untuk mengelola keluarga online.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-xl bg-[#0066cc] px-4 py-3 text-sm font-medium text-white"
          >
            Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <AppShell current="family">
      <div className="w-full py-6 sm:py-8">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
            Ruang bersama
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Keluarga
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Kelola anggota, akses, dan ringkasan keuangan keluarga dalam satu
            tempat.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <form
            onSubmit={submitFamily}
            className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] transition-shadow hover:shadow-[0_8px_24px_rgb(15_23_42/0.06)] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-semibold text-blue-700">
                +
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">Buat keluarga</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Buat ruang keuangan bersama untuk anggota keluarga Anda.
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-3 pt-5 sm:flex-row">
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field mt-0"
                placeholder="Nama keluarga baru"
              />
              <button
                type="submit"
                disabled={creating}
                className="min-h-11 shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Membuat..." : "Buat keluarga"}
              </button>
            </div>
          </form>
          <form
            onSubmit={joinWithCode}
            className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] transition-shadow hover:shadow-[0_8px_24px_rgb(15_23_42/0.06)] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg font-semibold text-emerald-700">
                ↗
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">
                  Gabung ke keluarga
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Masukkan kode gabung yang dibagikan oleh owner keluarga.
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
              <input
                required
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                className="field mt-0 font-mono tracking-wider"
                placeholder="KEU-XXXXXXXX"
                pattern="KEU-[A-Z0-9]{8}"
                aria-label="Kode gabung keluarga"
              />
              <button
                type="submit"
                disabled={joining}
                className="min-h-11 shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joining ? "Bergabung..." : "Gabung"}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-7 space-y-5">
          {families.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-500">
                ♧
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Belum ada keluarga
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Buat ruang keluarga baru atau gabung menggunakan kode undangan.
              </p>
            </div>
          ) : (
            families.map((family) => (
              <section
                key={family.id}
                className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_16px_rgb(15_23_42/0.04)]"
              >
                <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                      Ruang keluarga
                    </p>
                    <h2 className="mt-1 break-words text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                      {family.name}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {family.owner_user_id === userId && (
                      <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        Owner
                      </span>
                    )}
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      Aktif
                    </span>
                  </div>
                </div>
                {family.owner_user_id === userId && (
                  <div className="grid gap-3 border-b border-slate-100 bg-slate-50/40 px-4 py-5 sm:px-6 lg:grid-cols-2">
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Undang anggota keluarga
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Tambahkan anggota melalui email dan tentukan aksesnya.
                      </p>
                      <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(event) =>
                            setInviteEmail(event.target.value)
                          }
                          placeholder="email anggota"
                          className="field mt-0"
                          aria-label="Email anggota yang diundang"
                        />
                        <DropdownField
                          value={inviteRole}
                          onChange={(value) =>
                            setInviteRole(value as "editor" | "viewer")
                          }
                          aria-label="Role anggota yang diundang"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </DropdownField>
                        <button
                          type="button"
                          onClick={() => void invite(family.id)}
                          disabled={
                            invitingFamilyId === family.id ||
                            !inviteEmail.trim()
                          }
                          className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-2"
                        >
                          {invitingFamilyId === family.id
                            ? "Mengirim..."
                            : "Kirim undangan"}
                        </button>
                      </div>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Kode gabung
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Kode aktif berlaku 24 jam dan dapat digunakan oleh
                        banyak anggota.
                      </p>
                      {activeCodes[family.id] ? (
                        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="break-all font-mono text-lg font-bold tracking-wider text-slate-900">
                            {activeCodes[family.id]?.code}
                          </p>
                          <p className="text-xs leading-5 text-slate-600 sm:text-right">
                            Aktif sampai{" "}
                            {new Date(
                              activeCodes[family.id]?.expiresAt ?? "",
                            ).toLocaleString("id-ID")}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <DropdownField
                            value={codeRole}
                            onChange={(value) =>
                              setCodeRole(value as "editor" | "viewer")
                            }
                            aria-label="Role kode gabung"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </DropdownField>
                          <button
                            type="button"
                            onClick={() => void createJoinCode(family.id)}
                            className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Buat kode
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="px-4 py-5 sm:px-6 sm:py-6">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Anggota keluarga
                      </h3>
                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                        Ringkasan ini hanya terlihat oleh anggota keluarga yang
                        aktif.
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {(members[family.id] ?? []).length} anggota
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {(members[family.id] ?? []).map((member) => (
                      <div
                        key={member.id}
                        className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgb(15_23_42/0.03)] sm:p-5"
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-semibold leading-5 text-slate-900">
                                  {memberUsernames[member.user_id] ??
                                    "Anggota keluarga"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-700">
                                    {member.role}
                                  </span>
                                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-emerald-700">
                                    {member.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {(() => {
                            const finance =
                              memberFinances[family.id]?.[member.user_id];
                            return (
                              <div className="mt-4 grid gap-2">
                                <div className="rounded-xl bg-slate-50 p-3.5 sm:flex sm:items-center sm:justify-between sm:gap-4">
                                  <p className="text-xs font-medium text-slate-500">
                                    Kekayaan bersih
                                  </p>
                                  <p className="mt-1 break-words text-lg font-bold leading-6 tracking-tight text-slate-950 tabular-nums sm:mt-0 sm:text-right">
                                    {currency.format(
                                      finance?.totalBalance ?? 0,
                                    )}
                                  </p>
                                </div>
                                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
                                  <div className="flex min-w-0 flex-col justify-center rounded-xl border border-slate-100 p-3">
                                    <p className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">
                                      Sumber dana
                                    </p>
                                    <p className="mt-1 break-words text-xs font-semibold leading-4 text-slate-800 tabular-nums sm:text-sm">
                                      {currency.format(
                                        finance?.sourceTotal ?? 0,
                                      )}
                                    </p>
                                    <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-xs">
                                      {finance?.sourceCount ?? 0} sumber dana
                                    </p>
                                  </div>
                                  <div className="flex min-w-0 flex-col justify-center rounded-xl border border-slate-100 p-3">
                                    <p className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">
                                      Investasi
                                    </p>
                                    <p className="mt-1 break-words text-xs font-semibold leading-4 text-slate-800 tabular-nums sm:text-sm">
                                      {currency.format(
                                        finance?.investmentTotal ?? 0,
                                      )}
                                    </p>
                                    <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-xs">
                                      {finance?.investmentCount ?? 0} investasi
                                    </p>
                                  </div>
                                  <div className="flex min-w-0 flex-col justify-center rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                                    <p className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">
                                      Piutang
                                    </p>
                                    <p className="mt-1 break-words text-xs font-semibold leading-4 text-slate-800 tabular-nums sm:text-sm">
                                      {currency.format(
                                        finance?.loanReceivableTotal ?? 0,
                                      )}
                                    </p>
                                    <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-xs">
                                      {finance?.loanReceivableCount ?? 0}{" "}
                                      catatan
                                    </p>
                                  </div>
                                  <div className="flex min-w-0 flex-col justify-center rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                                    <p className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">
                                      Utang
                                    </p>
                                    <p className="mt-1 break-words text-xs font-semibold leading-4 text-slate-800 tabular-nums sm:text-sm">
                                      {currency.format(
                                        finance?.loanPayableTotal ?? 0,
                                      )}
                                    </p>
                                    <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-xs">
                                      {finance?.loanPayableCount ?? 0} catatan
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        {(family.owner_user_id === userId &&
                          member.role !== "owner") ||
                        (family.owner_user_id !== userId &&
                          member.user_id === userId) ? (
                          <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 sm:justify-end">
                            {family.owner_user_id === userId &&
                              member.role !== "owner" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void changeRole(
                                      member,
                                      member.role === "editor"
                                        ? "viewer"
                                        : "editor",
                                    )
                                  }
                                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Jadikan{" "}
                                  {member.role === "editor"
                                    ? "viewer"
                                    : "editor"}
                                </button>
                              )}
                            {family.owner_user_id === userId &&
                              member.role !== "owner" && (
                                <button
                                  type="button"
                                  onClick={() => setDeactivating(member)}
                                  className="min-h-10 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                >
                                  Cabut akses
                                </button>
                              )}
                            {family.owner_user_id !== userId &&
                              member.user_id === userId && (
                                <button
                                  type="button"
                                  onClick={() => void leave(family.id)}
                                  disabled={leavingFamilyId === family.id}
                                  className="min-h-10 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 sm:col-span-2"
                                >
                                  {leavingFamilyId === family.id
                                    ? "Keluar..."
                                    : "Keluar dari keluarga"}
                                </button>
                              )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))
          )}
        </div>
      </div>
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
      {deactivating && (
        <ActionModal
          title="Nonaktifkan anggota?"
          description={`Akses anggota ${deactivating.user_id.slice(0, 8)} akan dicabut dari keluarga.`}
          submitLabel="Nonaktifkan"
          destructive
          submitting={deactivatingBusy}
          onClose={() => setDeactivating(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void deactivate(deactivating);
          }}
        >
          <p>Anggota ini tidak lagi dapat mengakses ruang keuangan keluarga.</p>
        </ActionModal>
      )}
    </AppShell>
  );
}
