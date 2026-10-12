"use client";

import type {
  Account,
  Category,
  FinancialTransaction,
} from "@/types/data-model";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function RecentTransactions({
  transactions,
  accounts,
  categories,
}: {
  transactions: FinancialTransaction[];
  accounts: Account[];
  categories: Category[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Aktivitas
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">
            Transaksi terbaru
          </h2>
        </div>
        <a
          href="/activity"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          Lihat semua →
        </a>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
        {transactions.length === 0 ? (
          <p className="bg-slate-50/60 px-4 py-10 text-center text-sm text-slate-500">
            Belum ada transaksi.
          </p>
        ) : (
          transactions.slice(0, 5).map((transaction, index) => {
            const category = categories.find(
              (item) => item.id === transaction.categoryId,
            );
            const account = accounts.find(
              (item) => item.id === transaction.accountId,
            );
            const income = transaction.transactionType === "income";
            return (
              <article
                key={transaction.id}
                className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3.5 transition-colors hover:bg-slate-50 sm:gap-4 sm:px-4 ${
                  index > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${income ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                >
                  {income ? "↗" : "↘"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                      {transaction.note || category?.name || "Transaksi"}
                    </p>
                    {category?.name && transaction.note && (
                      <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 sm:inline-flex">
                        {category.name}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {account?.name ?? "Akun"}
                    <span className="mx-1.5 text-slate-300">·</span>
                    {transaction.transactionDate}
                  </p>
                </div>
                <span
                  className={`whitespace-nowrap text-right text-sm font-bold tabular-nums ${income ? "text-emerald-700" : "text-slate-800"}`}
                >
                  {income ? "+" : "-"}
                  {currency.format(transaction.amount)}
                </span>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
