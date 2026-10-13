import type { Account } from "@/types/data-model";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const labels = {
  source: "Sumber Dana",
  savings: "Tabungan",
  investment: "Investasi",
};

export function AssetOverview({
  balances,
}: {
  balances: Array<{ account: Account; balance: number }>;
}) {
  const currentBalances = balances.filter(
    ({ account }) => account.accountType !== "receivable",
  );
  const grouped = currentBalances.reduce<Record<string, number>>(
    (result, item) => {
      const key =
        item.account.accountType === "investment"
          ? "investment"
          : item.account.accountType === "savings"
            ? "savings"
            : "source";
      result[key] = (result[key] ?? 0) + item.balance;
      return result;
    },
    {},
  );

  const orderedTypes = Object.keys(labels).filter(
    (type) => grouped[type] !== undefined,
  ) as Array<keyof typeof labels>;
  const totalBalance = currentBalances.reduce(
    (total, item) => total + item.balance,
    0,
  );

  return (
    <section className="flex h-full min-w-0 min-h-[430px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgb(15_23_42/0.04)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Ringkasan aset
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">
            Sebaran saldo
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {currentBalances.length} dompet
        </span>
      </div>
      {currentBalances.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Tambahkan aset pertama seperti saldo rekening atau dompet tunai.
        </p>
      ) : (
        <div className="mt-5 flex-1 space-y-4">
          {orderedTypes.map((type) => {
            const value = grouped[type] ?? 0;
            const percentage =
              totalBalance > 0 ? Math.max(0, (value / totalBalance) * 100) : 0;
            return (
              <div key={type}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-600">
                    {labels[type]}
                  </span>
                  <span className="font-bold tabular-nums text-slate-950">
                    {currency.format(value)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
