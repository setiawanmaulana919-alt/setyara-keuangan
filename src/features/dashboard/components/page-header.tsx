"use client";

export function DashboardPageHeader({
  onAddTransaction,
  greetingName,
}: {
  onAddTransaction: () => void;
  greetingName: string;
}) {
  return (
    <div className="flex flex-col gap-5 pb-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400">
          Selasa, 11 Juni 2025
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Selamat datang, {greetingName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Berikut ringkasan kondisi keuangan Anda.
        </p>
      </div>
      <button
        type="button"
        onClick={onAddTransaction}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0071e3] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0066cc]"
      >
        + Tambah transaksi
      </button>
    </div>
  );
}
