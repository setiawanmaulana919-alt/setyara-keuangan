"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCurrentUser,
  getUserProfile,
  sendPasswordChangeCode,
  updateUserEmail,
  updateUserPassword,
  updateUserProfile,
  verifyEmailChangeCode,
  verifyPasswordChangeCode,
} from "@/lib/supabase/auth";
import { AppShell } from "@/components/shared/app-shell";
import { ActionModal } from "@/components/ui/action-modal";
import { PageLoading } from "@/components/ui/page-loading";
import { Snackbar } from "@/components/ui/snackbar";

function PasswordVisibilityToggle({
  visible,
  onClick,
  label,
}: {
  visible: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="ml-2 shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
    >
      {visible ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.8 10.8 0 0 1 12 4c5.2 0 8.8 4 10 8-.4 1.2-1 2.3-1.9 3.4M6.2 6.2C4.5 7.5 3.4 9.2 2 12c1.2 4 4.8 8 10 8 1.7 0 3.2-.4 4.5-1.1" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      )}
    </button>
  );
}

export default function ProfilePage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmationVisible, setPasswordConfirmationVisible] =
    useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordCode, setPasswordCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailVerificationOpen, setEmailVerificationOpen] = useState(false);
  const [passwordVerificationOpen, setPasswordVerificationOpen] =
    useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const user = await getCurrentUser();
    setCloudReady(Boolean(user));
    if (!user) {
      setEmail("");
      setNewEmail("");
      setUsername("");
      setName("");
      setAvatarUrl("");
      return;
    }

    setEmail(user.email ?? "");
    setNewEmail("");
    const metadataUsername =
      typeof user.user_metadata?.username === "string"
        ? user.user_metadata.username
        : "";
    const emailUsername = user.email
      ? user.email
          .split("@")[0]
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 30)
      : "";
    setUsername(metadataUsername || emailUsername);
    setName(
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "",
    );
    setAvatarUrl(
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : "",
    );

    try {
      const databaseProfile = await getUserProfile(user.id);
      if (!metadataUsername && databaseProfile?.username) {
        setUsername(databaseProfile.username);
      }
      if (!user.user_metadata?.name && databaseProfile?.displayName) {
        setName(databaseProfile.displayName);
      }
      if (databaseProfile?.avatarUrl) {
        setAvatarUrl(databaseProfile.avatarUrl);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `Username belum dapat dimuat dari database. Data Auth tetap tersedia. Detail: ${reason.message}`
          : "Username belum dapat dimuat dari database. Data Auth tetap tersedia.",
      );
    }
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(() => loadProfile())
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Sesi akun gagal dimuat. Silakan masuk kembali.",
        );
        setCloudReady(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loadProfile]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cloudReady) {
      setError("Masuk ke akun terlebih dahulu untuk mengubah profil.");
      return;
    }
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) {
      setError(
        "Username wajib diisi dengan 3–30 karakter berupa huruf, angka, atau garis bawah.",
      );
      return;
    }
    setProfileSaving(true);
    setError("");
    setMessage("");
    try {
      const updatedUser = await updateUserProfile({
        username,
        name,
        avatarUrl,
      });
      setAvatarUrl(
        typeof updatedUser.user_metadata?.avatar_url === "string"
          ? updatedUser.user_metadata.avatar_url
          : "",
      );
      setMessage("Profil berhasil diperbarui.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Profil gagal diperbarui.",
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newEmail.trim() === email) {
      setError("Email baru harus berbeda dari email saat ini.");
      return;
    }
    setEmailSaving(true);
    setError("");
    setMessage("");
    try {
      await updateUserEmail(newEmail.trim());
      setEmailVerificationOpen(true);
      setMessage(
        "Kode verifikasi perubahan email telah dikirim ke email baru.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Email gagal diperbarui.",
      );
    } finally {
      setEmailSaving(false);
    }
  }

  async function confirmEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifyingEmail(true);
    setError("");
    try {
      const response = await verifyEmailChangeCode(newEmail.trim(), emailCode);
      if (response.error) throw response.error;
      setEmail(newEmail.trim());
      setNewEmail("");
      setEmailCode("");
      setEmailVerificationOpen(false);
      setMessage("Email berhasil diperbarui.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Kode verifikasi email tidak valid.",
      );
    } finally {
      setVerifyingEmail(false);
    }
  }

  async function requestPasswordChange(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!password || !passwordConfirmation) {
      setError("Password baru dan konfirmasi password wajib diisi.");
      return;
    }
    if (password.length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Konfirmasi password baru tidak cocok.");
      return;
    }
    setPasswordSaving(true);
    setError("");
    setMessage("");
    try {
      await sendPasswordChangeCode(email);
      setPasswordVerificationOpen(true);
      setMessage("Kode verifikasi sudah dikirim ke email Anda.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Kode verifikasi gagal dikirim.",
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  async function confirmPasswordChange(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setVerifyingPassword(true);
    setError("");
    try {
      const response = await verifyPasswordChangeCode(email, passwordCode);
      if (response.error) throw response.error;
      await updateUserPassword(password);
      setPassword("");
      setPasswordConfirmation("");
      setPasswordCode("");
      setPasswordVerificationOpen(false);
      setMessage("Password berhasil diperbarui.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Kode verifikasi atau password tidak valid.",
      );
    } finally {
      setVerifyingPassword(false);
    }
  }

  function selectAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Foto profil harus berformat JPEG, PNG, atau WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran foto profil maksimal 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setAvatarUrl(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setError("Foto profil gagal dibaca.");
    reader.readAsDataURL(file);
  }

  return (
    <AppShell current="profile">
      <div className="py-5 sm:py-8">
        <div className="border-b border-slate-200 pb-6">
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Profil akun
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Informasi profil dan akun Anda.
          </p>
        </div>

        {!cloudReady && (
          <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Anda belum masuk ke akun. Profil cloud dan perubahan akun akan
            tersedia setelah login.
          </p>
        )}
        <form
          onSubmit={saveProfile}
          className="mt-6 w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <label className="relative cursor-pointer">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Foto profil"
                  onError={() => setAvatarUrl("")}
                  className="h-16 w-16 rounded-2xl object-cover ring-4 ring-slate-50"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-xl font-bold text-blue-700 ring-1 ring-inset ring-blue-100">
                  {(name[0] ?? email[0] ?? "?").toUpperCase()}
                </span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={selectAvatar}
                className="sr-only"
              />
              <span className="absolute -bottom-1 -right-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
                Ganti foto
              </span>
            </label>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">
                {name || "Nama belum diatur"}
              </p>
              <p className="mt-1 break-all text-sm text-slate-500">
                {email || "Belum masuk ke akun cloud"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Foto profil JPEG, PNG, atau WebP (maks. 2 MB)
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
            <label className="label">
              Username
              <input
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]+"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="field"
                placeholder="username_anda"
                disabled={!cloudReady}
              />
              <span className="text-xs font-normal text-slate-400">
                Dipakai untuk masuk. Gunakan 3–30 karakter: huruf, angka, atau
                garis bawah.
              </span>
            </label>
            <label className="label">
              Nama tampilan
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field"
                placeholder="Nama Anda"
                disabled={!cloudReady}
              />
            </label>
            <button
              type="submit"
              disabled={!cloudReady || profileSaving}
              className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
            >
              Simpan perubahan
            </button>
          </div>
        </form>
        {loading ? (
          <PageLoading label="Memuat profil akun..." />
        ) : (
          <div className="mt-5 grid w-full gap-5 lg:grid-cols-2">
            <form
              onSubmit={(event) => void saveEmail(event)}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-6"
            >
              <h2 className="font-semibold text-slate-950">Email akun</h2>
              <p className="mt-1 text-sm text-slate-500">
                Perubahan email membutuhkan konfirmasi dari email baru.
              </p>
              <label className="label mt-4">
                Email saat ini
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="field bg-slate-50 text-slate-500"
                />
              </label>
              <label className="label mt-3">
                Email baru
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  className="field"
                  placeholder="nama@email.com"
                  disabled={!cloudReady || emailSaving}
                />
              </label>
              <p className="mt-2 text-xs text-slate-400">
                Tombol ini hanya mengirim kode ke email baru dan tidak menyimpan
                perubahan profil lainnya.
              </p>
              <button
                type="submit"
                disabled={!cloudReady || emailSaving}
                className="mt-auto pt-5 text-left disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex min-h-11 items-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-600/20 transition-colors hover:bg-rose-700 active:bg-rose-800">
                  {emailSaving ? "Mengirim kode..." : "Konfirmasi email"}
                </span>
              </button>
            </form>
            <form
              onSubmit={(event) => void requestPasswordChange(event)}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-6"
            >
              <h2 className="font-semibold text-slate-950">Password</h2>
              <p className="mt-1 text-sm text-slate-500">
                Kode verifikasi akan dikirim ke email akun Anda.
              </p>
              <label className="label mt-4 block">
                Password baru
                <span className="mt-1.5 flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
                  <input
                    required
                    type={passwordVisible ? "text" : "password"}
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
                    placeholder="Minimal 8 karakter"
                    disabled={!cloudReady || passwordSaving}
                  />
                  <PasswordVisibilityToggle
                    visible={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    label={
                      passwordVisible
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                  />
                </span>
              </label>
              <label className="label mt-3 block">
                Konfirmasi password baru
                <span className="mt-1.5 flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
                  <input
                    required
                    type={passwordConfirmationVisible ? "text" : "password"}
                    minLength={8}
                    value={passwordConfirmation}
                    onChange={(event) =>
                      setPasswordConfirmation(event.target.value)
                    }
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
                    placeholder="Ulangi password baru"
                    disabled={!cloudReady || passwordSaving}
                  />
                  <PasswordVisibilityToggle
                    visible={passwordConfirmationVisible}
                    onClick={() =>
                      setPasswordConfirmationVisible((visible) => !visible)
                    }
                    label={
                      passwordConfirmationVisible
                        ? "Sembunyikan konfirmasi password"
                        : "Tampilkan konfirmasi password"
                    }
                  />
                </span>
              </label>
              <p className="mt-2 text-xs text-slate-400">
                Tombol ini hanya mengirim kode ke email akun Anda.
              </p>
              <button
                type="submit"
                disabled={!cloudReady || passwordSaving}
                className="mt-auto pt-5 text-left disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex min-h-11 items-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-rose-600/20 transition-colors hover:bg-rose-700 active:bg-rose-800">
                  {passwordSaving ? "Mengirim kode..." : "Konfirmasi password"}
                </span>
              </button>
            </form>
          </div>
        )}
      </div>
      {emailVerificationOpen && (
        <ActionModal
          title="Konfirmasi perubahan email"
          description={`Masukkan kode 8 digit yang dikirim ke ${newEmail}.`}
          submitLabel="Konfirmasi email"
          submitting={verifyingEmail}
          onClose={() => setEmailVerificationOpen(false)}
          onSubmit={confirmEmailChange}
        >
          <label className="label">
            Kode verifikasi email
            <input
              required
              autoFocus
              inputMode="numeric"
              pattern="\d{8}"
              maxLength={8}
              value={emailCode}
              onChange={(event) =>
                setEmailCode(event.target.value.replace(/\D/g, ""))
              }
              className="field text-center text-xl tracking-[0.35em]"
              placeholder="00000000"
            />
          </label>
        </ActionModal>
      )}
      {passwordVerificationOpen && (
        <ActionModal
          title="Konfirmasi perubahan password"
          description={`Masukkan kode 8 digit yang dikirim ke ${email}.`}
          submitLabel="Konfirmasi password"
          submitting={verifyingPassword}
          onClose={() => setPasswordVerificationOpen(false)}
          onSubmit={confirmPasswordChange}
        >
          <label className="label">
            Kode verifikasi email
            <input
              required
              autoFocus
              inputMode="numeric"
              pattern="\d{8}"
              maxLength={8}
              value={passwordCode}
              onChange={(event) =>
                setPasswordCode(event.target.value.replace(/\D/g, ""))
              }
              className="field text-center text-xl tracking-[0.35em]"
              placeholder="00000000"
            />
          </label>
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
    </AppShell>
  );
}
