import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  getAccountBalances,
  getDashboardData,
} from "@/features/dashboard/api/dashboard-api";
import { refreshInvestmentMarketPrices } from "@/features/wallets/api/investment-market-api";
import { listFamilies, type Family } from "@/features/family/api/family-api";
import type {
  DashboardData,
  DashboardSummary,
} from "@/features/dashboard/types";

const emptySummary: DashboardSummary = {
  balance: 0,
  income: 0,
  expense: 0,
  cashFlow: 0,
  expenseByCategory: [],
};

export function useDashboard() {
  const [summary, setSummary] = useState(emptySummary);
  const [balances, setBalances] = useState<DashboardData["balances"]>([]);
  const [goals, setGoals] = useState<DashboardData["goals"]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [greetingName, setGreetingName] = useState("Pengguna anonim");
  const [transactions, setTransactions] = useState<
    DashboardData["transactions"]
  >([]);
  const [transfers, setTransfers] = useState<DashboardData["transfers"]>([]);
  const [accounts, setAccounts] = useState<DashboardData["accounts"]>([]);
  const [categories, setCategories] = useState<DashboardData["categories"]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const hasLoadedDashboard = useRef(false);

  const refresh = useCallback(async () => {
    if (!hasLoadedDashboard.current) setLoading(true);
    setError("");
    const today = new Date().toISOString().slice(0, 10);
    try {
      const dashboard = await getDashboardData(`${today.slice(0, 8)}01`, today);
      let nextFamilies: Family[] = [];
      try {
        nextFamilies = await listFamilies();
      } catch (reason) {
        console.warn(
          "Daftar keluarga tidak tersedia; target mandiri tetap dapat digunakan.",
          reason,
        );
      }
      const marketTargets = dashboard.accounts.filter(
        (account) =>
          account.accountType === "investment" &&
          ["stock", "crypto", "gold"].includes(account.investmentType ?? "") &&
          Boolean(account.assetSymbol),
      );
      if (marketTargets.length > 0) {
        await refreshInvestmentMarketPrices(dashboard.accounts);
        const refreshedBalances = await getAccountBalances();
        dashboard.accounts = refreshedBalances.map(({ account }) => account);
        dashboard.balances = refreshedBalances;
      }
      setSummary(dashboard.summary);
      setBalances(dashboard.balances);
      setGoals(dashboard.goals);
      setTransactions(dashboard.transactions);
      setTransfers(dashboard.transfers);
      setAccounts(dashboard.accounts);
      setCategories(dashboard.categories);
      setFamilies(nextFamilies);
      hasLoadedDashboard.current = true;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(() => refresh())
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "Gagal memuat dashboard.",
        );
      });
  }, [refresh]);

  useEffect(() => {
    const handleCloudUpdate = () => {
      void refresh().catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "Gagal memuat dashboard.",
        );
      });
    };
    window.addEventListener("cloud-sync-updated", handleCloudUpdate);
    return () =>
      window.removeEventListener("cloud-sync-updated", handleCloudUpdate);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        if (document.visibilityState !== "visible") return;
        void refresh().catch((reason: unknown) => {
          setError(
            reason instanceof Error
              ? reason.message
              : "Gagal memperbarui harga.",
          );
        });
      },
      5 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    void Promise.resolve()
      .then(() => getCurrentUser())
      .then((user) => {
        const name =
          typeof user?.user_metadata?.name === "string"
            ? user.user_metadata.name.trim()
            : "";
        const emailName = user?.email?.split("@")[0] ?? "";
        setGreetingName(name || emailName || "Pengguna anonim");
      })
      .catch((reason: unknown) => {
        console.warn("Nama pengguna tidak dapat dimuat:", reason);
        setGreetingName("Pengguna anonim");
      });
  }, []);

  return {
    summary,
    balances,
    goals,
    error,
    setError,
    loading,
    greetingName,
    transactions,
    transfers,
    accounts,
    categories,
    families,
    refresh,
  };
}
