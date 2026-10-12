import type { DashboardSummary } from "@/features/dashboard/types";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function ExpenseBreakdown({
  items,
  total,
}: {
  items: DashboardSummary["expenseByCategory"];
  total: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgb(15_23_42/0.03)] sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Pengeluaran
      </p>
      <h2 className="mt-1 text-lg font-semibold">Ke mana uangmu pergi?</h2>
      {items.length === 0 || total === 0 ? (
        <p className="mt-5 text-sm text-slate-500">
          Belum ada pengeluaran pada periode ini.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className="mx-auto flex h-36 w-36 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#f59e0b 0 24%, #60a5fa 24% 52%, #a78bfa 52% 72%, #34d399 72% 88%, #fb7185 88% 100%)`,
            }}
          >
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center">
              <span className="text-[10px] text-slate-400">Total</span>
              <span className="text-xs font-bold text-slate-800">
                {currency.format(total)}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            {items.slice(0, 5).map((item) => {
              const percentage = Math.round((item.amount / total) * 100);
              return (
                <div key={item.categoryId}>
                  <div className="flex justify-between gap-4 text-sm">
                    <span>{item.name}</span>
                    <span className="tabular-nums text-slate-500">
                      {percentage}% · {currency.format(item.amount)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-blue-400"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
