"use client";

import { useMemo, useState } from "react";
import type { DashboardSummary } from "@/features/dashboard/types";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const chartColors = [
  "#2563eb",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
  "#f43f5e",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

const circleCircumference = 100;

export function ExpenseBreakdown({
  items,
  total,
}: {
  items: DashboardSummary["expenseByCategory"];
  total: number;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const chartItems = useMemo(
    () =>
      items
        .filter((item) => item.amount > 0)
        .map((item, index) => ({
          ...item,
          color: chartColors[index % chartColors.length],
        })),
    [items],
  );
  const chartTotal = chartItems.reduce((sum, item) => sum + item.amount, 0);
  const selectedItem =
    chartItems.find((item) => item.categoryId === selectedCategoryId) ?? null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgb(15_23_42/0.03)] sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Pengeluaran
      </p>
      <h2 className="mt-1 text-lg font-semibold">Ke mana uangmu pergi?</h2>
      {chartItems.length === 0 || chartTotal === 0 || total === 0 ? (
        <p className="mt-5 text-sm text-slate-500">
          Belum ada pengeluaran pada periode ini.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-40 w-40 shrink-0">
            <svg
              className="h-full w-full -rotate-90 overflow-visible"
              viewBox="0 0 42 42"
              role="group"
              aria-label={`Donut chart pengeluaran berdasarkan ${chartItems.length} kategori`}
            >
              <circle
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="7"
              />
              {(() => {
                let offset = 0;
                return chartItems.map((item) => {
                  const share =
                    (item.amount / chartTotal) * circleCircumference;
                  const segment = (
                    <circle
                      key={item.categoryId}
                      cx="21"
                      cy="21"
                      r="15.915"
                      fill="none"
                      stroke={item.color}
                      strokeWidth={
                        selectedItem?.categoryId === item.categoryId ? 8 : 7
                      }
                      strokeDasharray={`${share} ${circleCircumference - share}`}
                      strokeDashoffset={-offset}
                      className="cursor-pointer transition-[stroke-width,opacity] hover:opacity-80 focus-visible:opacity-70"
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.name}: ${currency.format(item.amount)}, ${Math.round((item.amount / chartTotal) * 100)} persen`}
                      aria-pressed={
                        selectedItem?.categoryId === item.categoryId
                      }
                      onClick={() =>
                        setSelectedCategoryId((current) =>
                          current === item.categoryId ? null : item.categoryId,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedCategoryId((current) =>
                            current === item.categoryId
                              ? null
                              : item.categoryId,
                          );
                        }
                      }}
                    />
                  );
                  offset += share;
                  return segment;
                });
              })()}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
              <span className="max-w-full truncate text-[10px] font-medium text-slate-500">
                {selectedItem?.name ?? "Total"}
              </span>
              <span className="max-w-full truncate text-sm font-bold text-slate-900">
                {currency.format(selectedItem?.amount ?? total)}
              </span>
              {selectedItem && (
                <span className="text-[10px] tabular-nums text-slate-500">
                  {Math.round((selectedItem.amount / chartTotal) * 100)}%
                </span>
              )}
            </div>
          </div>
          <div className="max-h-64 min-w-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {chartItems.map((item) => {
              const percentage = Math.round((item.amount / chartTotal) * 100);
              const selected = selectedItem?.categoryId === item.categoryId;
              return (
                <button
                  key={item.categoryId}
                  type="button"
                  onClick={() =>
                    setSelectedCategoryId((current) =>
                      current === item.categoryId ? null : item.categoryId,
                    )
                  }
                  aria-pressed={selected}
                  className={`w-full rounded-xl p-2 text-left transition-colors ${
                    selected ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <i
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate font-medium text-slate-800">
                        {item.name}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {percentage}% · {currency.format(item.amount)}
                    </span>
                  </div>
                  <div className="mt-2 ml-[1.125rem] h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full transition-[width]"
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
