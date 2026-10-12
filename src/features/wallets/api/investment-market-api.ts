import { updateAccountMarketPrice } from "@/features/wallets/api/wallets-api";
import type { Account } from "@/types/data-model";

export async function refreshInvestmentMarketPrices(
  accounts: Account[],
): Promise<void> {
  const targets = accounts.filter(
    (account) =>
      account.accountType === "investment" &&
      ["stock", "crypto", "gold"].includes(account.investmentType ?? "") &&
      Boolean(account.assetSymbol),
  );
  const nowMs = Date.now();
  const groups = new Map<string, Account[]>();
  for (const account of targets) {
    const marketUpdatedAt = Date.parse(account.marketUpdatedAt ?? "");
    const quoteAge = nowMs - marketUpdatedAt;
    const isFresh =
      Number.isFinite(marketUpdatedAt) &&
      quoteAge >= 0 &&
      quoteAge < 5 * 60 * 1000;
    if (isFresh) continue;
    const key =
      account.investmentType === "gold"
        ? "gold:antam"
        : `${account.investmentType}:${account.assetSymbol!.toLocaleUpperCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), account]);
  }

  await Promise.all(
    [...groups.values()].map(async (groupedAccounts) => {
      const account = groupedAccounts[0];
      const endpoint =
        account.investmentType === "stock"
          ? `/api/market/stock?symbol=${encodeURIComponent(account.assetSymbol!)}`
          : account.investmentType === "crypto"
            ? `/api/market/crypto?symbol=${encodeURIComponent(account.assetSymbol!)}`
            : "/api/market/gold?source=antam";
      const response = await fetch(endpoint);
      const result = (await response.json()) as {
        price?: number;
        updatedAt?: string;
        error?: string;
      };
      if (!response.ok || typeof result.price !== "number") {
        throw new Error(
          result.error ?? `Harga ${account.assetSymbol} gagal dimuat.`,
        );
      }
      const roundedPrice = Math.round(result.price);
      await Promise.all(
        groupedAccounts
          .filter((target) => target.marketPrice !== roundedPrice)
          .map((target) =>
            updateAccountMarketPrice(
              target.id,
              roundedPrice,
              result.updatedAt ?? new Date().toISOString(),
            ),
          ),
      );
    }),
  );
}
