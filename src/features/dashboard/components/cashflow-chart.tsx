"use client";

import { useMemo } from "react";
import { DateField } from "@/components/ui/date-field";
import { useCashflowChart } from "@/features/dashboard/hooks/use-cashflow-chart";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatLabel(key: string, group: "day" | "month"): string {
  if (group === "month") {
    return new Intl.DateTimeFormat("id-ID", {
      month: "short",
    }).format(new Date(`${key}-01T00:00:00`));
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${key}T00:00:00`));
}

function dateParts(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function createKeys(from: string, to: string, group: "day" | "month") {
  const keys: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    keys.push(
      group === "month"
        ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
        : dateParts(cursor),
    );
    if (group === "month") {
      cursor.setMonth(cursor.getMonth() + 1, 1);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return keys;
}

function createSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const distance = point.x - previous.x;
    return `${path} C ${previous.x + distance / 3} ${previous.y}, ${point.x - distance / 3} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

export function CashflowChart() {
  const {
    mode,
    setMode,
    month,
    setMonth,
    year,
    setYear,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    range,
    totals,
    loading,
    error,
    retry,
  } = useCashflowChart();

  const chart = useMemo(() => {
    if (!range.from || !range.to) {
      return {
        items: [],
        maximum: 1,
        group: "day" as const,
        from: "",
        to: "",
        labelStride: 1,
      };
    }
    const from = range.from <= range.to ? range.from : range.to;
    const to = range.from <= range.to ? range.to : range.from;
    const dayCount =
      Math.round(
        (new Date(`${to}T00:00:00`).getTime() -
          new Date(`${from}T00:00:00`).getTime()) /
          86_400_000,
      ) + 1;
    const group = mode === "year" || dayCount > 31 ? "month" : "day";
    const values = new Map<string, { income: number; expense: number }>();
    createKeys(from, to, group).forEach((key) =>
      values.set(key, { income: 0, expense: 0 }),
    );
    totals.forEach((total) => {
      const key =
        group === "month" ? total.periodStart.slice(0, 7) : total.periodStart;
      const currentValue = values.get(key);
      if (!currentValue) return;
      currentValue[total.transactionType] += total.amount;
    });
    const items = Array.from(values, ([key, value]) => ({
      key,
      label: formatLabel(key, group),
      ...value,
    }));
    const maximum = Math.max(
      ...items.map((item) => Math.max(item.income, item.expense)),
      1,
    );
    const labelStride =
      items.length > 20
        ? Math.ceil(items.length / 8)
        : items.length > 10
          ? 2
          : 1;
    return { items, maximum, group, from, to, labelStride };
  }, [mode, range, totals]);

  const selectedLabel =
    mode === "year"
      ? year
      : mode === "custom"
        ? `${range.from} - ${range.to}`
        : month
          ? new Intl.DateTimeFormat("id-ID", {
              month: "long",
              year: "numeric",
            }).format(new Date(`${month}-01T00:00:00`))
          : "Memuat periode...";
  const graphWidth = Math.max(chart.items.length * 42, 560);
  const plotLeft = 48;
  const plotRight = graphWidth - 16;
  const plotTop = 14;
  const plotBottom = 172;
  const plotHeight = plotBottom - plotTop;
  const points = chart.items.map((item, index) => {
    const x =
      chart.items.length <= 1
        ? (plotLeft + plotRight) / 2
        : plotLeft +
          (index * (plotRight - plotLeft)) / (chart.items.length - 1);
    return {
      income: {
        x: x - 3,
        y: plotBottom - (item.income / chart.maximum) * plotHeight,
        amount: item.income,
      },
      expense: {
        x: x + 3,
        y: plotBottom - (item.expense / chart.maximum) * plotHeight,
        amount: item.expense,
      },
    };
  });
  const incomePoints = points.map((point) => point.income);
  const expensePoints = points.map((point) => point.expense);
  const incomePath = createSmoothPath(incomePoints);
  const expensePath = createSmoothPath(expensePoints);
  const incomeArea =
    incomePoints.length > 0
      ? `${incomePath} L ${incomePoints[incomePoints.length - 1].x} ${plotBottom} L ${incomePoints[0].x} ${plotBottom} Z`
      : "";
  const expenseArea =
    expensePoints.length > 0
      ? `${expensePath} L ${expensePoints[expensePoints.length - 1].x} ${plotBottom} L ${expensePoints[0].x} ${plotBottom} Z`
      : "";
  const compactCurrency = new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return (
    <section className="flex h-full min-w-0 min-h-[390px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_28px_rgb(15_23_42/0.045)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Ringkasan keuangan
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              Arus kas
            </h2>
            <p className="text-xs font-medium text-slate-500">
              {selectedLabel}
            </p>
          </div>
        </div>
        <div
          className="inline-flex w-fit rounded-xl bg-slate-100/80 p-1"
          aria-label="Pilih periode grafik"
        >
          {(["month", "year", "custom"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {value === "month"
                ? "Bulan"
                : value === "year"
                  ? "Tahun"
                  : "Rentang"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex min-h-11 flex-wrap items-start gap-3">
        {mode === "month" && (
          <DateField
            mode="month"
            value={month}
            onChange={setMonth}
            aria-label="Pilih bulan"
            className="max-w-44"
          />
        )}
        {mode === "year" && (
          <input
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="field w-full"
            aria-label="Pilih tahun"
          />
        )}
        {mode === "custom" && (
          <>
            <DateField
              value={customFrom}
              onChange={setCustomFrom}
              aria-label="Tanggal mulai"
              className="max-w-44"
            />
            <DateField
              value={customTo}
              onChange={setCustomTo}
              aria-label="Tanggal akhir"
              className="max-w-44"
            />
          </>
        )}
      </div>

      <div className="mt-4 flex items-center gap-5 text-[11px] font-medium text-slate-500">
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />{" "}
          Pemasukan
        </span>
        <span className="flex items-center gap-2">
          <i className="h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />{" "}
          Pengeluaran
        </span>
      </div>
      <div className="mt-3 min-h-[220px] flex-1 overflow-x-auto">
        {error ? (
          <div className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-xl bg-rose-50/70 px-4 text-center text-sm text-rose-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={retry}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
            >
              Coba lagi
            </button>
          </div>
        ) : loading ? (
          <div className="flex h-[220px] items-center justify-center rounded-xl bg-slate-50/70 px-4 text-center text-sm text-slate-400">
            Memuat grafik arus kas...
          </div>
        ) : chart.items.every(
            (item) => item.income === 0 && item.expense === 0,
          ) ? (
          <div className="flex h-[220px] items-center justify-center rounded-xl bg-slate-50/70 px-4 text-center text-sm text-slate-400">
            Belum ada transaksi pada periode ini.
          </div>
        ) : (
          <>
            <svg
              role="img"
              aria-label={`Grafik arus kas ${selectedLabel}`}
              className="block h-[190px] max-w-none"
              width={graphWidth}
              height="190"
              viewBox={`0 0 ${graphWidth} 190`}
            >
              <defs>
                <linearGradient
                  id="cashflow-income-fill"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
                <linearGradient
                  id="cashflow-expense-fill"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#fb7185" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((tick) => {
                const y = plotTop + (plotHeight * tick) / 3;
                const value = chart.maximum * (1 - tick / 3);
                return (
                  <g key={tick}>
                    <line
                      x1={plotLeft}
                      x2={plotRight}
                      y1={y}
                      y2={y}
                      stroke="#e9edf3"
                      strokeDasharray={tick === 3 ? undefined : "3 5"}
                    />
                    <text
                      x={plotLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[9px]"
                    >
                      {compactCurrency.format(value)}
                    </text>
                  </g>
                );
              })}
              <path d={incomeArea} fill="url(#cashflow-income-fill)" />
              <path d={expenseArea} fill="url(#cashflow-expense-fill)" />
              <path
                d={incomePath}
                fill="none"
                stroke="#3b82f6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={expensePath}
                fill="none"
                stroke="#fb7185"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((point, index) => (
                <g key={chart.items[index].key}>
                  {point.income.amount > 0 && (
                    <circle
                      cx={point.income.x}
                      cy={point.income.y}
                      r="4"
                      fill="white"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                    >
                      <title>
                        {chart.items[index].label} · pemasukan{" "}
                        {currency.format(point.income.amount)}
                      </title>
                    </circle>
                  )}
                  {point.expense.amount > 0 && (
                    <circle
                      cx={point.expense.x}
                      cy={point.expense.y}
                      r="4"
                      fill="white"
                      stroke="#fb7185"
                      strokeWidth="2.5"
                    >
                      <title>
                        {chart.items[index].label} · pengeluaran{" "}
                        {currency.format(point.expense.amount)}
                      </title>
                    </circle>
                  )}
                </g>
              ))}
            </svg>
            <div
              className="mt-1 flex px-1 text-[9px] font-medium text-slate-400"
              style={{ width: `${graphWidth}px`, paddingLeft: `${plotLeft}px` }}
            >
              {chart.items.map((item, index) => (
                <span
                  key={item.key}
                  className="min-w-0 flex-1 truncate text-center"
                  title={item.label}
                >
                  {index % chart.labelStride === 0 ? item.label : ""}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="mt-3 min-h-4 text-[10px] text-slate-400">
        {chart.items.length
          ? `${chart.from} sampai ${chart.to} · ${chart.group === "month" ? "per bulan" : "per hari"}`
          : "Belum ada data pada periode ini."}
      </p>
    </section>
  );
}
