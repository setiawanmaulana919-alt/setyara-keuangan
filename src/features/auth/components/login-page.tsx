"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  signInWithPassword,
  signUpWithPassword,
  verifyEmailCode,
} from "@/lib/supabase/auth";
import { Snackbar } from "@/components/ui/snackbar";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "verify">("sign-in");
  const [verificationCode, setVerificationCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      if (mode === "verify") {
        const response = await verifyEmailCode(email, verificationCode);
        if (response.error) throw response.error;
        setMessage("Email berhasil diverifikasi. Silakan masuk.");
        setMode("sign-in");
        setVerificationCode("");
        return;
      }
      if (mode === "sign-up" && password !== passwordConfirmation) {
        throw new Error("Konfirmasi password tidak cocok.");
      }
      const response =
        mode === "sign-in"
          ? await signInWithPassword(email, password)
          : await signUpWithPassword(email, password, {
              username,
            });
      if (response.error) throw response.error;
      if (mode === "sign-in" || response.data.session) {
        router.push("/");
        router.refresh();
      } else {
        setMessage("Akun dibuat. Masukkan kode 8 digit yang dikirim ke email.");
        setMode("verify");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Autentikasi gagal.");
    } finally {
      setSubmitting(false);
    }
  }

  const isSignUp = mode === "sign-up";
  const isVerify = mode === "verify";

  return (
    <main className="min-h-screen bg-[#f7f8fa] lg:grid lg:grid-cols-[minmax(560px,1.28fr)_minmax(360px,0.72fr)]">
      <aside className="relative hidden overflow-hidden bg-[#0b2a55] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#e5b94d]/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[#2f80ed]/20 blur-3xl" />
        <Link
          href="/login"
          className="relative inline-flex w-fit items-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/Logo_Setyara_Biru_Aksen_Emas.svg"
            alt="Setyara"
            className="h-10 w-10 rounded-xl bg-white object-contain p-1"
          />
          <span className="text-xl font-bold tracking-tight">Setyara</span>
        </Link>
        <div className="relative w-full max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#f3cc68]">
            Keuangan lebih tertata
          </p>
          <h2 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Satu ruang untuk keuangan Anda.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-blue-100">
            Catat transaksi, pantau target, dan kelola keuangan dengan lebih
            sederhana.
          </p>
          <div className="mt-10 max-w-xl" aria-hidden="true">
            <svg
              viewBox="0 0 560 210"
              fill="none"
              className="h-auto w-full overflow-visible"
            >
              <path
                d="M16 178H544M16 128H544M16 78H544M16 28H544"
                stroke="white"
                strokeOpacity=".1"
              />
              <path
                d="m38 128 76-34 76 22 76-44 76 12 76-48 76 17v125H38V128Z"
                fill="url(#login-chart)"
              />
              <path
                d="M56 178V142M132 178V116M208 178V130M284 178V88M360 178V104M436 178V58M512 178V76"
                stroke="url(#login-bars)"
                strokeLinecap="round"
                strokeWidth="18"
              />
              <path
                d="m38 128 76-34 76 22 76-44 76 12 76-48 76 17"
                stroke="#F3CC68"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
              <circle cx="418" cy="36" r="6" fill="#F3CC68" />
              <circle
                cx="418"
                cy="36"
                r="12"
                stroke="#F3CC68"
                strokeOpacity=".25"
                strokeWidth="2"
              />
              <defs>
                <linearGradient
                  id="login-bars"
                  x1="56"
                  y1="58"
                  x2="512"
                  y2="178"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#60A5FA" stopOpacity=".35" />
                  <stop offset="1" stopColor="#60A5FA" stopOpacity=".08" />
                </linearGradient>
                <linearGradient
                  id="login-chart"
                  x1="286"
                  y1="36"
                  x2="286"
                  y2="178"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#F3CC68" stopOpacity=".16" />
                  <stop offset="1" stopColor="#F3CC68" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        <p className="relative text-xs text-blue-200">
          Aman dan mudah digunakan.
        </p>
      </aside>
      <section className="relative flex min-h-screen items-center justify-center px-5 py-24 sm:px-8 sm:py-8 lg:px-16 xl:px-24">
        <div className="absolute left-5 right-5 top-8 flex items-center justify-between sm:hidden">
          <Link href="/login" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/Logo_Setyara_Biru_Aksen_Emas.svg"
              alt="Setyara"
              className="h-10 w-10 rounded-xl object-contain"
            />
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Setyara
            </span>
          </Link>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {isVerify
              ? "Langkah terakhir"
              : isSignUp
                ? "Akun baru"
                : "Selamat datang"}
          </span>
        </div>
        <form
          onSubmit={submit}
          className="w-full max-w-md min-w-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-3xl sm:border sm:border-slate-200/80 sm:bg-white sm:p-8 sm:shadow-[0_18px_50px_rgb(15_23_42/0.06)] lg:max-w-xl lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
        >
          <div className="hidden items-center justify-between sm:flex lg:hidden">
            <span className="text-sm font-semibold text-slate-700">
              Setyara
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {isVerify
                ? "Langkah terakhir"
                : isSignUp
                  ? "Akun baru"
                  : "Selamat datang"}
            </span>
          </div>
          <h1 className="mt-7 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl lg:mt-0">
            {mode === "sign-in"
              ? "Masuk ke Setyara"
              : mode === "sign-up"
                ? "Buat akun online"
                : "Verifikasi email"}
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            {mode === "verify"
              ? `Masukkan kode verifikasi yang dikirim ke ${email}.`
              : isSignUp
                ? "Daftarkan akun untuk menyimpan data keuangan Anda dengan aman."
                : "Masuk untuk mengakses dashboard dan menyimpan data keuangan di cloud."}
          </p>
          {!isVerify && (
            <label className="label mt-8 text-slate-700">
              {isSignUp ? "Email" : "Username atau email"}
              <input
                required
                type={isSignUp ? "email" : "text"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field border-slate-200 bg-slate-50/70 py-3 focus:bg-white"
                placeholder={
                  isSignUp ? "nama@email.com" : "Email atau username Anda"
                }
                autoComplete={isSignUp ? "email" : "username"}
              />
            </label>
          )}
          {isSignUp && (
            <label className="label mt-5 text-slate-700">
              Username
              <input
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]+"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="field border-slate-200 bg-slate-50/70 py-3 focus:bg-white"
                placeholder="username_anda"
                autoComplete="username"
              />
            </label>
          )}
          {!isVerify && (
            <label className="label mt-5 text-slate-700">
              Password
              <span className="relative mt-1 block">
                <input
                  required
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="field mt-0 border-slate-200 bg-slate-50/70 py-3 pr-12 focus:bg-white"
                  placeholder="Minimal 8 karakter"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
                <PasswordToggle
                  visible={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                />
              </span>
            </label>
          )}
          {isVerify && (
            <label className="label mt-8 text-slate-700">
              Kode konfirmasi email
              <input
                required
                inputMode="numeric"
                pattern="\d{8}"
                maxLength={8}
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(event.target.value.replace(/\D/g, ""))
                }
                className="field border-slate-200 bg-slate-50/70 text-center text-xl tracking-[0.35em]"
                placeholder="00000000"
              />
            </label>
          )}
          {isSignUp && (
            <>
              <label className="label mt-5 text-slate-700">
                Konfirmasi password
                <span className="relative mt-1 block">
                  <input
                    required
                    minLength={8}
                    type={showPasswordConfirmation ? "text" : "password"}
                    value={passwordConfirmation}
                    onChange={(event) =>
                      setPasswordConfirmation(event.target.value)
                    }
                    className="field mt-0 border-slate-200 bg-slate-50/70 py-3 pr-12 focus:bg-white"
                    placeholder="Ulangi password"
                    autoComplete="new-password"
                  />
                  <PasswordToggle
                    visible={showPasswordConfirmation}
                    onClick={() =>
                      setShowPasswordConfirmation((visible) => !visible)
                    }
                  />
                </span>
              </label>
              <p className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-700">
                Setelah mendaftar, periksa email dan masukkan kode 8 digit
                konfirmasi sebelum masuk.
              </p>
            </>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-7 w-full rounded-xl bg-[#0066cc] px-4 py-3.5 font-semibold text-white shadow-[0_8px_20px_rgb(0_102_204/0.2)] hover:bg-[#005bb8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? "Memproses..."
              : mode === "sign-in"
                ? "Masuk"
                : mode === "sign-up"
                  ? "Daftar"
                  : "Verifikasi email"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(
                mode === "sign-in"
                  ? "sign-up"
                  : mode === "sign-up"
                    ? "sign-in"
                    : "sign-in",
              );
              setError("");
              setMessage("");
            }}
            className="mt-5 w-full text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            {mode === "sign-in"
              ? "Belum punya akun? Daftar"
              : "Sudah punya akun? Masuk"}
          </button>
        </form>
      </section>
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
    </main>
  );
}

function PasswordToggle({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
    >
      {visible ? (
        <svg
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
