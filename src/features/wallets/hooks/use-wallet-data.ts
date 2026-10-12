import { useCallback, useEffect, useState } from "react";
import { getAccountBalances } from "@/features/dashboard/api/dashboard-api";
import { refreshInvestmentMarketPrices } from "@/features/wallets/api/investment-market-api";
import type { AccountBalance } from "@/features/wallets/types";
import { ensureFinanceDefaults } from "@/features/finance/api/initialization-api";
import {
  listLoanRecords,
  type LoanRecord,
} from "@/features/loans/api/loans-api";

export function useWalletData() {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    await ensureFinanceDefaults();
    const [currentBalances, currentLoans] = await Promise.all([
      getAccountBalances(),
      listLoanRecords(),
    ]);
    await refreshInvestmentMarketPrices(
      currentBalances.map(({ account }) => account),
    );
    const updatedBalances = await getAccountBalances();
    setBalances(updatedBalances);
    setLoans(currentLoans);
  }, []);

  const refreshLoanBalances = useCallback(async () => {
    const [updatedBalances, updatedLoans] = await Promise.all([
      getAccountBalances(),
      listLoanRecords(),
    ]);
    setBalances(updatedBalances);
    setLoans(updatedLoans);
  }, []);

  useEffect(() => {
    void Promise.resolve()
      .then(() => refresh())
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Data dompet gagal dimuat.",
        );
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const handleCloudUpdate = () => {
      void refresh().catch((reason: unknown) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Data dompet gagal dimuat.",
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
              : "Harga gagal diperbarui.",
          );
        });
      },
      5 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [refresh]);

  return {
    balances,
    loans,
    loading,
    error,
    setError,
    refresh,
    refreshLoanBalances,
  };
}
