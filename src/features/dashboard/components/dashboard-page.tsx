"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { DashboardPageHeader } from "@/features/dashboard/components/page-header";
import { SummaryCards } from "@/features/dashboard/components/summary-cards";
import { AssetOverview } from "@/features/dashboard/components/asset-overview";
import { ExpenseBreakdown } from "@/features/dashboard/components/expense-breakdown";
import { CashflowChart } from "@/features/dashboard/components/cashflow-chart";
import { RecentTransactions } from "@/features/dashboard/components/recent-transactions";
import { Snackbar } from "@/components/ui/snackbar";
import { GoalsSection } from "@/features/goals/components/goals-section";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default function Home() {
  const router = useRouter();
  const {
    summary,
    balances,
    goals,
    error,
    setError,
    loading,
    greetingName,
    transactions,
    accounts,
    categories,
    families,
    refresh,
  } = useDashboard();

  return (
    <AppShell current="dashboard">
      <div className="py-5 sm:py-8">
        <DashboardPageHeader
          greetingName={greetingName}
          onAddTransaction={() =>
            window.dispatchEvent(new Event("open-quick-add"))
          }
        />

        {loading && <DashboardLoading />}
        <div className={loading ? "hidden" : "block"}>
          <section className="mt-5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-[0_8px_24px_rgb(37_99_235/0.18)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-blue-100">Total saldo · Pribadi</p>
                <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                  {currency.format(summary.balance)}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg">
                ◈
              </span>
            </div>
            <p className="mt-4 text-xs text-blue-100">
              Saldo tersedia dari seluruh sumber dana yang tercatat belum
              termasuk investasi dan piutang.
            </p>
          </section>

          <SummaryCards summary={summary} />

          <GoalsSection
            goals={goals}
            families={families}
            accounts={accounts}
            currency={currency}
            onChanged={() => void refresh()}
          />

          <section className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,1fr)]">
            <CashflowChart />
            <AssetOverview balances={balances} />
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            <ExpenseBreakdown
              items={summary.expenseByCategory}
              total={summary.expense}
            />

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Aksi cepat
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Kelola keuangan
                  </h2>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  {
                    icon: "＋",
                    label: "Tambah transaksi",
                    action: () =>
                      window.dispatchEvent(new Event("open-quick-add")),
                  },
                  {
                    icon: "↔",
                    label: "Transfer",
                    action: () =>
                      window.dispatchEvent(new Event("open-quick-add")),
                  },
                  {
                    icon: "◈",
                    label: "Dompet",
                    action: () => router.push("/wallets"),
                  },
                  {
                    icon: "▥",
                    label: "Lihat laporan",
                    action: () => router.push("/activity"),
                  },
                ].map(({ icon, label, action }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-blue-200 hover:bg-blue-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-blue-600 shadow-sm">
                      {icon}
                    </span>
                    <span className="mt-2 block text-xs font-semibold text-slate-700">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </section>

          <section className="mt-5">
            <RecentTransactions
              transactions={transactions}
              accounts={accounts}
              categories={categories}
            />
          </section>
        </div>
      </div>
      {error && (
        <Snackbar
          message={error}
          tone="error"
          onClose={() => setError("")}
          actionLabel="Coba lagi"
          onAction={() => {
            setError("");
            void refresh().catch((reason: unknown) => {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Gagal memuat dashboard.",
              );
            });
          }}
        />
      )}
    </AppShell>
  );
}

function DashboardLoading() {
  return (
    <div
      className="mt-5 space-y-5"
      aria-busy="true"
      aria-label="Memuat dashboard"
    >
      <p className="text-sm font-medium text-slate-500">Memuat data cloud...</p>
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-36 animate-pulse rounded-2xl bg-slate-200"
          />
        ))}
      </div>
      <div className="h-52 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}
