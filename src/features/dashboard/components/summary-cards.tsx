import type { DashboardSummary } from "@/features/dashboard/types";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const cards = [
    {
      label: "Pemasukan",
      value: summary.income,
      icon: "↗",
      iconClass: "bg-emerald-50 text-emerald-600",
      valueClass: "text-emerald-700",
    },
    {
      label: "Pengeluaran",
      value: summary.expense,
      icon: "↘",
      iconClass: "bg-rose-50 text-rose-600",
      valueClass: "text-rose-700",
    },
    {
      label: "Arus kas bersih",
      value: summary.cashFlow,
      icon: "＝",
      iconClass:
        summary.cashFlow >= 0
          ? "bg-blue-50 text-blue-600"
          : "bg-amber-50 text-amber-600",
      valueClass: summary.cashFlow >= 0 ? "text-slate-950" : "text-amber-700",
    },
  ];

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Ringkasan keuangan
          </p>
          <p className="mt-1 text-sm text-slate-500">Performa bulan berjalan</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon, iconClass, valueClass }) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-6"
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold ${iconClass}`}
              >
                {icon}
              </span>
              <span className="text-xs font-medium text-slate-400">
                Bulan ini
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-slate-600">{label}</p>
            <p
              className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${valueClass}`}
            >
              {currency.format(value)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
