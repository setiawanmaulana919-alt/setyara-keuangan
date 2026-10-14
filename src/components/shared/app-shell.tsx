"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getCurrentUser, signOut } from "@/lib/supabase/auth";
import { ActionModal } from "@/components/ui/action-modal";
import { QuickAddModal } from "@/features/transactions/components/quick-add-modal";
import { subscribeToCloudChanges } from "@/lib/supabase/realtime";

type AppRoute =
  "dashboard" | "activity" | "wallets" | "family" | "profile" | "accounts";

type NavIcon = "home" | "activity" | "wallet" | "user";

const navItems: Array<{
  href: string;
  label: string;
  route: AppRoute;
  icon: NavIcon;
}> = [
  { href: "/", label: "Home", route: "dashboard", icon: "home" },
  { href: "/activity", label: "Activity", route: "activity", icon: "activity" },
  { href: "/wallets", label: "Dompet", route: "wallets", icon: "wallet" },
  { href: "/accounts", label: "Saya", route: "accounts", icon: "user" },
];

function NavigationIcon({
  name,
  className = "h-5 w-5",
}: {
  name: NavIcon;
  className?: string;
}) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
      </svg>
    );
  }

  if (name === "activity") {
    return (
      <svg {...common}>
        <path d="M4 19V5M4 19h16" />
        <path d="m7 15 3-3 3 2 5-6" />
        <path d="M18 8h-3V5" />
      </svg>
    );
  }

  if (name === "wallet") {
    return (
      <svg {...common}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" />
        <path d="M4 7h15M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
        <path d="M17.5 14h.01" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function AppShell({
  current = "dashboard",
  children,
}: {
  current?: AppRoute;
  children: React.ReactNode;
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<
    import("@/types/data-model").FinancialTransaction | null
  >(null);
  const [editingTransfer, setEditingTransfer] = useState<
    import("@/types/data-model").Transfer | null
  >(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!profileOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !profileMenuRef.current?.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    void getCurrentUser()
      .then((user) => {
        setEmail(user?.email ?? null);
        setCloudReady(Boolean(user));
        setDisplayName(
          typeof user?.user_metadata?.name === "string"
            ? user.user_metadata.name
            : "",
        );
        setAvatarUrl(
          typeof user?.user_metadata?.avatar_url === "string"
            ? user.user_metadata.avatar_url
            : "",
        );
        setAuthChecked(true);
      })
      .catch((reason: unknown) => {
        setCloudReady(false);
        setAuthError(
          reason instanceof Error
            ? reason.message
            : "Sesi akun tidak dapat diperiksa.",
        );
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    if (!cloudReady) return;
    let active = true;
    const unsubscribe = subscribeToCloudChanges((reason) => {
      if (active) console.error("Realtime Supabase gagal:", reason);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [cloudReady]);

  useEffect(() => {
    if (!authChecked) return;
    if (!cloudReady && !authError) window.location.replace("/login");
  }, [authChecked, authError, cloudReady]);

  useEffect(() => {
    const openQuickAdd = () => setQuickAddOpen(true);
    const openEditTransaction = (event: Event) => {
      const transaction = (event as CustomEvent).detail;
      setEditingTransaction(transaction);
      setEditingTransfer(null);
      setQuickAddOpen(true);
    };
    const openEditTransfer = (event: Event) => {
      setEditingTransaction(null);
      setEditingTransfer((event as CustomEvent).detail);
      setQuickAddOpen(true);
    };
    window.addEventListener("open-quick-add", openQuickAdd);
    window.addEventListener("open-quick-add-edit", openEditTransaction);
    window.addEventListener("open-quick-add-transfer-edit", openEditTransfer);
    return () => {
      window.removeEventListener("open-quick-add", openQuickAdd);
      window.removeEventListener("open-quick-add-edit", openEditTransaction);
      window.removeEventListener(
        "open-quick-add-transfer-edit",
        openEditTransfer,
      );
    };
  }, []);

  if (!authChecked || !cloudReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-5">
        <div className="max-w-md text-center">
          <p
            role={authError ? "alert" : undefined}
            className={`text-sm ${authError ? "text-rose-700" : "text-slate-500"}`}
          >
            {!authChecked
              ? "Memeriksa sesi..."
              : authError
                ? `Sesi akun tidak dapat diperiksa. ${authError}`
                : "Mengarahkan ke halaman masuk..."}
          </p>
          {authError && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              Coba lagi
            </button>
          )}
        </div>
      </main>
    );
  }

  async function logout() {
    setLogoutBusy(true);
    try {
      await signOut();
      setEmail(null);
      setCloudReady(false);
      setDisplayName("");
      setAvatarUrl("");
      setProfileOpen(false);
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-100 px-6 py-6">
          <Link href="/" className="flex h-16 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/Logo_Setyara_Biru_Aksen_Emas.svg"
              alt="Setara"
              className="h-10 w-10 rounded-xl object-contain"
            />
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Setara
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4" aria-label="Navigasi utama">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Menu utama
          </p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
                current === item.route
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <NavigationIcon name={item.icon} className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="flex h-12 items-center gap-2 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/Logo_Setyara_Biru_Aksen_Emas.svg"
                alt="Setara"
                className="h-9 w-9 rounded-lg object-contain"
              />
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Setara
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <div
                ref={profileMenuRef}
                className="relative border-l border-slate-200 pl-3 sm:pl-4"
              >
                <button
                  type="button"
                  onClick={() => setProfileOpen((current) => !current)}
                  aria-expanded={profileOpen}
                  aria-controls="profile-menu"
                  aria-haspopup="menu"
                  className="flex min-h-12 items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-50"
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Foto profil"
                      onError={() => setAvatarUrl("")}
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 ring-2 ring-white shadow-sm">
                      {(displayName[0] ?? email?.[0] ?? "?").toUpperCase()}
                    </span>
                  )}
                  <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-36 truncate text-xs font-semibold leading-4 text-slate-800">
                      {displayName || email?.split("@")[0] || "Belum masuk"}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                      {cloudReady ? "Akun cloud" : "Mode lokal"}
                    </span>
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                  >
                    <path
                      d="m5 7.5 5 5 5-5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.7"
                    />
                  </svg>
                </button>
                {profileOpen && (
                  <div
                    id="profile-menu"
                    role="menu"
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_16px_40px_rgb(15_23_42/0.16)]"
                  >
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarUrl}
                            alt=""
                            onError={() => setAvatarUrl("")}
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                            {(
                              displayName[0] ??
                              email?.[0] ??
                              "?"
                            ).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {displayName ||
                              email?.split("@")[0] ||
                              "Belum masuk"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {email || "Mode lokal"}
                          </span>
                        </span>
                      </div>
                      <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            cloudReady ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {cloudReady ? "Cloud aktif" : "Hanya di perangkat"}
                      </span>
                    </div>
                    <Link
                      href="/accounts"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Pusat akun
                    </Link>
                    {cloudReady ? (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={logoutBusy}
                        onClick={() => {
                          setProfileOpen(false);
                          setLogoutConfirmOpen(true);
                        }}
                        className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {logoutBusy ? "Keluar..." : "Keluar dari akun"}
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        role="menuitem"
                        onClick={() => setProfileOpen(false)}
                        className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        Masuk ke akun
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        {logoutConfirmOpen && (
          <ActionModal
            title="Keluar dari akun?"
            description="Sesi Anda akan diakhiri pada perangkat ini."
            submitLabel="Keluar"
            destructive
            submitting={logoutBusy}
            onClose={() => setLogoutConfirmOpen(false)}
            onSubmit={(event) => {
              event.preventDefault();
              void logout().then(() => setLogoutConfirmOpen(false));
            }}
          >
            <p>Anda perlu masuk kembali untuk membuka dashboard.</p>
          </ActionModal>
        )}
        <main className="mx-auto w-full max-w-[1280px] px-4 pb-28 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
        <QuickAddModal
          open={quickAddOpen}
          editingTransaction={editingTransaction}
          editingTransfer={editingTransfer}
          onClose={() => {
            setQuickAddOpen(false);
            setEditingTransaction(null);
            setEditingTransfer(null);
          }}
          onSaved={() => {
            setQuickAddOpen(false);
            setEditingTransaction(null);
            setEditingTransfer(null);
            window.dispatchEvent(new Event("cloud-sync-updated"));
          }}
        />
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/90 px-3 pt-2 shadow-[0_-8px_24px_rgb(15_23_42/0.06)] backdrop-blur-xl [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
          aria-label="Navigasi mobile"
        >
          <div className="mx-auto grid max-w-md grid-cols-5 items-center gap-1">
            {navItems.map((item, index) => {
              const active = current === item.route;
              return (
                <span key={item.href} className="contents">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    }`}
                  >
                    <NavigationIcon name={item.icon} className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                  {index === 1 && (
                    <button
                      type="button"
                      onClick={() => setQuickAddOpen(true)}
                      aria-label="Tambah transaksi"
                      className="mx-auto flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_8px_20px_rgb(37_99_235/0.35)] ring-4 ring-[#f5f5f7] transition-transform hover:scale-105 active:scale-95"
                    >
                      <svg
                        className="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
