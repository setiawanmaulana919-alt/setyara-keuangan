import { useEffect, useMemo, useState } from "react";
import { getTransactionPeriodTotals } from "@/features/transactions/api/transactions-api";

export type FilterMode = "month" | "year" | "custom";

function dateParts(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthStart(value: Date): string {
  return dateParts(new Date(value.getFullYear(), value.getMonth(), 1));
}

function monthEnd(value: Date): string {
  return dateParts(new Date(value.getFullYear(), value.getMonth() + 1, 0));
}

export function useCashflowChart() {
  const [mode, setMode] = useState<FilterMode>("month");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [requestState, setRequestState] = useState<{
    key: string;
    totals: Awaited<ReturnType<typeof getTransactionPeriodTotals>>;
    error: string;
  }>({ key: "", totals: [], error: "" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = new Date();
      setMonth(
        `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`,
      );
      setYear(String(current.getFullYear()));
      setCustomFrom(monthStart(current));
      setCustomTo(monthEnd(current));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const range = useMemo(() => {
    if (!month || !year || !customFrom || !customTo) {
      return { from: "", to: "" };
    }
    if (mode === "year") {
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    if (mode === "custom") {
      return { from: customFrom, to: customTo };
    }
    const selected = new Date(`${month}-01T00:00:00`);
    return { from: monthStart(selected), to: monthEnd(selected) };
  }, [customFrom, customTo, mode, month, year]);

  useEffect(() => {
    if (!range.from || !range.to) return;
    const from = range.from <= range.to ? range.from : range.to;
    const to = range.from <= range.to ? range.to : range.from;
    const dayCount =
      Math.round(
        (new Date(`${to}T00:00:00`).getTime() -
          new Date(`${from}T00:00:00`).getTime()) /
          86_400_000,
      ) + 1;
    const groupByMonth = mode === "year" || dayCount > 31;
    const key = `${from}:${to}:${groupByMonth}:${retryKey}`;
    let active = true;
    void getTransactionPeriodTotals(from, to, groupByMonth)
      .then((totals) => {
        if (active) setRequestState({ key, totals, error: "" });
      })
      .catch((reason: unknown) => {
        if (active) {
          setRequestState({
            key,
            totals: [],
            error:
              reason instanceof Error
                ? reason.message
                : "Gagal memuat grafik arus kas.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [mode, range.from, range.to, retryKey]);

  const requestFrom =
    range.from && range.to
      ? range.from <= range.to
        ? range.from
        : range.to
      : "";
  const requestTo =
    range.from && range.to
      ? range.from <= range.to
        ? range.to
        : range.from
      : "";
  const requestDayCount =
    requestFrom && requestTo
      ? Math.round(
          (new Date(`${requestTo}T00:00:00`).getTime() -
            new Date(`${requestFrom}T00:00:00`).getTime()) /
            86_400_000,
        ) + 1
      : 0;
  const requestKey = `${requestFrom}:${requestTo}:${mode === "year" || requestDayCount > 31}:${retryKey}`;
  const hasCurrentResult =
    requestState.key === requestKey && Boolean(requestFrom);

  return {
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
    totals: hasCurrentResult ? requestState.totals : [],
    loading: !hasCurrentResult,
    error: hasCurrentResult ? requestState.error : "",
    retry: () => setRetryKey((current) => current + 1),
  };
}
