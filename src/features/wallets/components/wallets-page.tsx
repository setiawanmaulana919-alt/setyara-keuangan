"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shared/app-shell";
import {
  createAccount,
  deleteAccount,
  updateAccount,
} from "@/features/wallets/api/wallets-api";
import type { AccountBalance } from "@/features/wallets/types";
import type { Account } from "@/types/data-model";
import { LoansSection } from "@/features/loans/components/loans-section";
import { ActionModal } from "@/components/ui/action-modal";
import { Snackbar } from "@/components/ui/snackbar";
import { formatNumberInput, parseNumberInput } from "@/lib/format-number";
import { IDX_STOCKS } from "@/lib/idx-stocks";
import { DateField } from "@/components/ui/date-field";
import { DropdownField } from "@/components/ui/dropdown-field";
import { useWalletData } from "@/features/wallets/hooks/use-wallet-data";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const accountTypes: Array<{
  value: Account["accountType"];
  label: string;
  icon: string;
}> = [
  { value: "bank", label: "Bank", icon: "▣" },
  { value: "eWallet", label: "E-wallet", icon: "◈" },
  { value: "cash", label: "Tunai", icon: "◉" },
  { value: "investment", label: "Investasi", icon: "↗" },
  { value: "other", label: "Lainnya", icon: "＋" },
];

export default function WalletsPage() {
  const {
    balances,
    loans,
    loading,
    error,
    setError,
    refresh,
    refreshLoanBalances,
  } = useWalletData();
  const [name, setName] = useState("");
  const [accountType, setAccountType] =
    useState<Account["accountType"]>("bank");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingBalanceDate, setOpeningBalanceDate] = useState("");
  const [investmentType, setInvestmentType] =
    useState<Account["investmentType"]>("stock");
  const [assetSymbol, setAssetSymbol] = useState("");
  const [assetUnit, setAssetUnit] = useState<Account["assetUnit"]>("lot");
  const [stockSearchOpen, setStockSearchOpen] = useState(false);
  const [assetQuantity, setAssetQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [marketPrice, setMarketPrice] = useState<number | undefined>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AccountBalance | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [cardIndexes, setCardIndexes] = useState<Record<string, number>>({});
  const stockSuggestions = useMemo(() => {
    const query = assetSymbol.trim().toLocaleLowerCase();
    if (!query) return IDX_STOCKS.slice(0, 8);
    return IDX_STOCKS.filter(
      (stock) =>
        stock.symbol.toLocaleLowerCase().includes(query) ||
        stock.name.toLocaleLowerCase().includes(query),
    ).slice(0, 8);
  }, [assetSymbol]);

  useEffect(() => {
    if (!openingBalanceDate) {
      const timer = window.setTimeout(() => {
        setOpeningBalanceDate(new Date().toISOString().slice(0, 10));
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [openingBalanceDate]);

  const sourceBalances = balances.filter(
    ({ account }) =>
      !["investment", "receivable"].includes(account.accountType),
  );
  const investmentBalances = balances.filter(
    ({ account }) => account.accountType === "investment",
  );
  const sumBalances = (items: AccountBalance[]) =>
    items.reduce((total, item) => total + item.balance, 0);
  const sourceTotal = sumBalances(sourceBalances);
  const investmentTotal = sumBalances(investmentBalances);
  const loanReceivableTotal = loans
    .filter((loan) => loan.direction === "receivable")
    .reduce((total, loan) => total + loan.remainingAmount, 0);
  const loanPayableTotal = loans
    .filter((loan) => loan.direction === "payable")
    .reduce((total, loan) => total + loan.remainingAmount, 0);
  const totalBalance =
    sourceTotal + investmentTotal + loanReceivableTotal - loanPayableTotal;
  const personalCashAccounts = balances
    .filter(
      ({ account }) =>
        account.scopeType === "personal" &&
        !["investment", "receivable"].includes(account.accountType),
    )
    .map(({ account }) => account);

  async function submitWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const input = {
        name,
        accountType,
        openingBalance:
          accountType === "investment"
            ? parseNumberInput(purchasePrice || "0") *
              Number(assetQuantity.replace(",", ".")) *
              (assetUnit === "lot" ? 100 : assetUnit === "kg" ? 1000 : 1)
            : parseNumberInput(openingBalance || "0"),
        openingBalanceDate,
        investmentType:
          accountType === "investment" ? investmentType : undefined,
        assetSymbol:
          accountType === "investment"
            ? investmentType === "gold"
              ? "ANTAM"
              : assetSymbol.toUpperCase()
            : undefined,
        assetQuantity:
          accountType === "investment"
            ? Number(assetQuantity.replace(",", "."))
            : undefined,
        assetUnit: accountType === "investment" ? assetUnit : undefined,
        purchasePrice:
          accountType === "investment"
            ? parseNumberInput(purchasePrice || "0")
            : undefined,
        marketPrice: accountType === "investment" ? marketPrice : undefined,
        marketUpdatedAt:
          accountType === "investment" && marketPrice
            ? new Date().toISOString()
            : undefined,
      };
      if (editingId) {
        await updateAccount(editingId, input);
      } else {
        await createAccount(input);
      }
      setName("");
      setOpeningBalance("");
      setInvestmentType("stock");
      setAssetSymbol("");
      setAssetUnit("lot");
      setStockSearchOpen(false);
      setAssetQuantity("");
      setPurchasePrice("");
      setMarketPrice(undefined);
      setQuoteMessage("");
      setAccountType("bank");
      setOpeningBalanceDate(new Date().toISOString().slice(0, 10));
      setFormOpen(false);
      setEditingId(null);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Dompet gagal ditambahkan.",
      );
    } finally {
      setSaving(false);
    }
  }

  function editWallet(item: AccountBalance) {
    setEditingId(item.account.id);
    setName(item.account.name);
    setAccountType(item.account.accountType);
    setOpeningBalance(formatNumberInput(String(item.account.openingBalance)));
    setInvestmentType(item.account.investmentType ?? "stock");
    setAssetSymbol(
      item.account.investmentType === "gold"
        ? "ANTAM"
        : (item.account.assetSymbol ?? ""),
    );
    setAssetUnit(item.account.assetUnit ?? "lot");
    setStockSearchOpen(false);
    setAssetQuantity(
      item.account.assetQuantity ? String(item.account.assetQuantity) : "",
    );
    setPurchasePrice(
      item.account.purchasePrice
        ? formatNumberInput(String(item.account.purchasePrice))
        : "",
    );
    setMarketPrice(item.account.marketPrice);
    setOpeningBalanceDate(item.account.openingBalanceDate);
    setFormOpen(true);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setAccountType("bank");
    setOpeningBalance("");
    setInvestmentType("stock");
    setAssetSymbol("");
    setAssetUnit("lot");
    setStockSearchOpen(false);
    setAssetQuantity("");
    setPurchasePrice("");
    setMarketPrice(undefined);
    setQuoteMessage("");
    setOpeningBalanceDate(new Date().toISOString().slice(0, 10));
    setFormOpen(false);
  }

  function openCreateForm(type: Account["accountType"] = "bank") {
    setEditingId(null);
    setName("");
    setAccountType(type);
    setOpeningBalance("");
    setInvestmentType("stock");
    setAssetSymbol("");
    setAssetUnit("lot");
    setStockSearchOpen(false);
    setAssetQuantity("");
    setPurchasePrice("");
    setMarketPrice(undefined);
    setQuoteMessage("");
    setOpeningBalanceDate(new Date().toISOString().slice(0, 10));
    setFormOpen(true);
    setError("");
  }

  async function fetchMarketQuote() {
    const symbol = assetSymbol.trim();
    if (
      (investmentType === "stock" && !/^[A-Z0-9]{1,6}\.JK$/.test(symbol)) ||
      (investmentType === "crypto" && !/^[a-z0-9]{2,20}_idr$/i.test(symbol))
    ) {
      setQuoteMessage(
        investmentType === "stock"
          ? "Pilih kode saham BEI dengan format seperti BBCA.JK."
          : "Pilih pasangan crypto dengan format seperti btc_idr.",
      );
      return;
    }
    setQuoteLoading(true);
    setQuoteMessage("");
    try {
      const endpoint =
        investmentType === "stock"
          ? `/api/market/stock?symbol=${encodeURIComponent(symbol.toUpperCase())}`
          : investmentType === "crypto"
            ? `/api/market/crypto?symbol=${encodeURIComponent(symbol.toLowerCase())}`
            : "/api/market/gold?source=antam";
      const response = await fetch(endpoint);
      const result = (await response.json()) as {
        price?: number;
        error?: string;
      };
      if (!response.ok || typeof result.price !== "number") {
        throw new Error(result.error ?? "Harga saham tidak tersedia.");
      }
      setMarketPrice(result.price);
      setQuoteMessage(`Harga terbaru ${currency.format(result.price)}.`);
    } catch (reason) {
      setQuoteMessage(
        reason instanceof Error ? reason.message : "Harga pasar gagal dimuat.",
      );
    } finally {
      setQuoteLoading(false);
    }
  }

  async function submitDelete() {
    if (!deleting) return;
    setSaving(true);
    setError("");
    try {
      await deleteAccount(deleting.account.id);
      setDeleting(null);
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Dompet gagal dihapus.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderBalanceCards(items: AccountBalance[], category: string) {
    const activeIndex = Math.min(
      cardIndexes[category] ?? 0,
      Math.max(items.length - 1, 0),
    );
    const activeItem = items[activeIndex];
    return (
      <div className="mt-4 flex flex-1 flex-col">
        <div className="mb-3 flex h-8 shrink-0 items-center justify-between gap-3">
          <span aria-live="polite" className="text-xs text-slate-400">
            {items.length
              ? `${activeIndex + 1} dari ${items.length}`
              : "0 kartu"}
          </span>
          {items.length > 1 && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() =>
                  setCardIndexes((current) => ({
                    ...current,
                    [category]: Math.max(activeIndex - 1, 0),
                  }))
                }
                disabled={activeIndex === 0}
                aria-label="Card sebelumnya"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() =>
                  setCardIndexes((current) => ({
                    ...current,
                    [category]: Math.min(activeIndex + 1, items.length - 1),
                  }))
                }
                disabled={activeIndex >= items.length - 1}
                aria-label="Card berikutnya"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg text-slate-500 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>
            </div>
          )}
        </div>
        {items.length ? (
          <article
            key={activeItem.account.id}
            className="flex min-h-[15rem] flex-1 flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
          >
            {(() => {
              const { account, balance } = activeItem;
              const type = accountTypes.find(
                (item) => item.value === account.accountType,
              );
              return (
                <>
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">
                      {type?.icon ?? "◈"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {type?.label ?? "Lainnya"}
                      </span>
                      <h3 className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {account.name}
                      </h3>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] text-slate-500">Saldo saat ini</p>
                    <p
                      className={`mt-1 truncate text-xl font-bold tracking-tight tabular-nums ${
                        balance < 0 ? "text-rose-700" : "text-slate-950"
                      }`}
                    >
                      {currency.format(balance)}
                    </p>
                    {account.accountType === "investment" &&
                      account.marketPrice !== undefined && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">
                          Harga pasar {currency.format(account.marketPrice)}
                          {account.marketUpdatedAt
                            ? ` · ${new Date(account.marketUpdatedAt).toLocaleString("id-ID")}`
                            : ""}
                        </p>
                      )}
                  </div>

                  <div className="mt-auto border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">Saldo awal</span>
                      <span className="text-xs font-semibold tabular-nums text-slate-600">
                        {currency.format(account.openingBalance)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => editWallet(activeItem)}
                        className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(activeItem)}
                        className="min-h-9 rounded-lg border border-rose-100 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </article>
        ) : (
          <p className="flex min-h-[15rem] flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
            Belum ada data pada kategori ini.
          </p>
        )}
      </div>
    );
  }

  return (
    <AppShell current="wallets">
      <div className="py-6 sm:py-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Dompet
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Simpan dan pantau saldo bank, e-wallet, tunai, dan sumber dana
              lainnya.
            </p>
          </div>
        </div>

        <section className="mt-6 rounded-3xl bg-blue-600 p-6 text-white shadow-[0_10px_28px_rgb(37_99_235/0.2)] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Ringkasan kekayaan
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Sumber dana + investasi + piutang - utang
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                {currency.format(totalBalance)}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-300">
              {balances.length} item aktif
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Sumber Dana", sourceTotal, "text-white"],
              ["Investasi", investmentTotal, "text-blue-300"],
              ["Piutang", loanReceivableTotal, "text-emerald-300"],
              ["Utang", loanPayableTotal, "text-amber-300"],
            ].map(([label, amount, color]) => (
              <div key={label} className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`mt-1 text-base font-bold tabular-nums ${color}`}>
                  {currency.format(Number(amount))}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-2">
          <section className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-lg text-blue-700">
                  ◈
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                    Sumber Dana
                  </h2>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Bank, e-wallet, dan tunai
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  formOpen ? cancelEdit() : openCreateForm("bank")
                }
                className="min-h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:px-4"
              >
                {formOpen ? "Tutup form" : "+ Tambah"}
              </button>
            </div>
            {loading ? (
              <div className="mt-4 h-[17rem] animate-pulse rounded-2xl bg-slate-200/70" />
            ) : (
              renderBalanceCards(sourceBalances, "source")
            )}
          </section>
          <section className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg text-violet-700">
                  ↗
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-950 sm:text-lg">
                    Investasi
                  </h2>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Pantau nilai aset investasi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openCreateForm("investment")}
                className="min-h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 sm:w-auto sm:px-4"
              >
                + Tambah investasi
              </button>
            </div>
            {loading ? (
              <div className="mt-4 h-[17rem] animate-pulse rounded-2xl bg-slate-200/70" />
            ) : (
              renderBalanceCards(investmentBalances, "investment")
            )}
          </section>
        </div>
        <LoansSection
          accounts={personalCashAccounts}
          onChanged={refreshLoanBalances}
        />
      </div>
      {formOpen && (
        <ActionModal
          title={
            editingId
              ? accountType === "investment"
                ? "Edit investasi"
                : "Edit sumber dana"
              : accountType === "investment"
                ? "Tambah investasi"
                : "Tambah sumber dana"
          }
          description={
            editingId
              ? "Perbarui nama, jenis, atau saldo awal dompet."
              : accountType === "investment"
                ? "Tambahkan aset investasi yang ingin dipantau."
                : "Tambahkan bank, e-wallet, tunai, atau sumber dana lainnya."
          }
          submitLabel={
            editingId
              ? "Simpan perubahan"
              : accountType === "investment"
                ? "Simpan investasi"
                : "Simpan sumber dana"
          }
          submitting={saving}
          onClose={cancelEdit}
          onSubmit={submitWallet}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">
              Nama
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field"
                placeholder={
                  accountType === "investment"
                    ? "Contoh: Saham BBCA"
                    : "Contoh: Bank BRI"
                }
              />
            </label>
            <label className="label">
              Kategori
              <DropdownField
                value={accountType}
                onChange={(value) =>
                  setAccountType(value as Account["accountType"])
                }
              >
                {accountTypes
                  .filter(
                    (type) =>
                      editingId ||
                      (accountType === "investment" &&
                        type.value === "investment") ||
                      (accountType !== "investment" &&
                        type.value !== "investment"),
                  )
                  .map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
              </DropdownField>
            </label>
          </div>
          <label className="label">
            Tanggal saldo awal
            <DateField
              required
              value={openingBalanceDate}
              onChange={setOpeningBalanceDate}
              aria-label="Tanggal saldo awal"
            />
          </label>
          {accountType === "investment" && (
            <div className="space-y-4 rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50 to-white p-4 sm:p-5">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Detail investasi
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Harga beli diisi manual. Harga pasar hanya untuk valuasi
                  terbaru.
                </p>
              </div>
              <label className="label">
                Jenis aset
                <DropdownField
                  value={investmentType ?? "stock"}
                  onChange={(value) => {
                    const nextType = value as NonNullable<
                      Account["investmentType"]
                    >;
                    setInvestmentType(nextType);
                    setAssetSymbol(
                      nextType === "gold"
                        ? "ANTAM"
                        : nextType === "crypto"
                          ? "btc_idr"
                          : "",
                    );
                    setAssetUnit(
                      nextType === "stock"
                        ? "lot"
                        : nextType === "gold"
                          ? "gram"
                          : "unit",
                    );
                    setMarketPrice(undefined);
                    setQuoteMessage("");
                  }}
                >
                  <option value="stock">Saham Indonesia</option>
                  <option value="crypto">Crypto</option>
                  <option value="gold">Emas Antam</option>
                </DropdownField>
              </label>
              {investmentType === "stock" && (
                <label className="label">
                  Kode saham BEI
                  <div className="relative">
                    <input
                      required
                      value={assetSymbol}
                      onFocus={() => setStockSearchOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => setStockSearchOpen(false), 150);
                      }}
                      onChange={(event) => {
                        setAssetSymbol(event.target.value.toUpperCase());
                        setStockSearchOpen(true);
                      }}
                      className="field uppercase"
                      placeholder="Ketik kode atau nama, misalnya B"
                      aria-label="Cari kode saham BEI"
                      aria-autocomplete="list"
                    />
                    {stockSearchOpen && stockSuggestions.length > 0 && (
                      <div
                        role="listbox"
                        className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                      >
                        {stockSuggestions.map((stock) => (
                          <button
                            key={stock.symbol}
                            type="button"
                            role="option"
                            aria-selected={stock.symbol === assetSymbol}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setAssetSymbol(stock.symbol);
                              setStockSearchOpen(false);
                            }}
                            className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-blue-50"
                          >
                            <span className="text-sm font-semibold text-slate-800">
                              {stock.symbol}
                            </span>
                            <span className="min-w-0 truncate text-xs text-slate-500">
                              {stock.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    951 emiten BEI tersedia. Bisa ketik kode atau nama
                    perusahaan.
                  </span>
                </label>
              )}
              {investmentType === "crypto" && (
                <label className="label">
                  Aset crypto
                  <DropdownField value={assetSymbol} onChange={setAssetSymbol}>
                    <option value="btc_idr">Bitcoin (BTC/IDR)</option>
                    <option value="eth_idr">Ethereum (ETH/IDR)</option>
                    <option value="sol_idr">Solana (SOL/IDR)</option>
                    <option value="xrp_idr">XRP (XRP/IDR)</option>
                    <option value="doge_idr">Dogecoin (DOGE/IDR)</option>
                  </DropdownField>
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Harga diambil dari market IDR INDODAX.
                  </span>
                </label>
              )}
              {investmentType === "gold" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  Harga pasar menggunakan harga jual emas Antam per gram.
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="label">
                  Jumlah
                  <input
                    required
                    min="0.000001"
                    step="any"
                    type="number"
                    value={assetQuantity}
                    onChange={(event) => setAssetQuantity(event.target.value)}
                    className="field"
                    placeholder={
                      investmentType === "stock" ? "Contoh: 10" : "Contoh: 0,5"
                    }
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    {investmentType === "stock"
                      ? "Masukkan jumlah lot."
                      : investmentType === "gold"
                        ? "Berat emas yang dimiliki."
                        : "Jumlah coin/token yang dimiliki."}
                  </span>
                </label>
                <label className="label">
                  Satuan
                  <DropdownField
                    value={assetUnit ?? "unit"}
                    onChange={(value) =>
                      setAssetUnit(value as NonNullable<Account["assetUnit"]>)
                    }
                  >
                    {investmentType === "stock" && (
                      <option value="lot">Lot (100 lembar)</option>
                    )}
                    {investmentType === "gold" && (
                      <>
                        <option value="gram">Gram</option>
                        <option value="kg">Kilogram</option>
                      </>
                    )}
                    {investmentType === "crypto" && (
                      <option value="unit">Coin/token</option>
                    )}
                  </DropdownField>
                </label>
                <label className="label">
                  Harga beli{" "}
                  {investmentType === "stock" ? "per lembar" : "per unit"}
                  <div className="money-field mt-1">
                    <span className="money-field-prefix">Rp</span>
                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      value={purchasePrice}
                      onChange={(event) =>
                        setPurchasePrice(formatNumberInput(event.target.value))
                      }
                      className="min-w-0 tabular-nums"
                      placeholder="0"
                    />
                  </div>
                  {marketPrice !== undefined && (
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Harga pasar terbaru: {currency.format(marketPrice)}
                    </span>
                  )}
                </label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void fetchMarketQuote()}
                  disabled={quoteLoading || !assetSymbol}
                  className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {quoteLoading ? "Mengambil harga..." : "Cek harga pasar"}
                </button>
                <span className="text-xs text-slate-500">
                  Tidak mengubah harga beli.
                </span>
              </div>
              {quoteMessage && (
                <p className="text-xs text-slate-600" role="status">
                  {quoteMessage}
                </p>
              )}
            </div>
          )}
          {accountType !== "investment" && (
            <label className="label">
              Saldo awal
              <div className="money-field mt-1">
                <span className="money-field-prefix">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={openingBalance}
                  onChange={(event) =>
                    setOpeningBalance(formatNumberInput(event.target.value))
                  }
                  className="min-w-0 tabular-nums"
                  placeholder="0"
                />
              </div>
            </label>
          )}
          {accountType !== "investment" && (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500">
              <span className="block font-semibold text-slate-700">
                Nilai tercatat
              </span>
              Saldo akan mengikuti transaksi dan transfer.
            </div>
          )}
        </ActionModal>
      )}
      {deleting && (
        <ActionModal
          title="Hapus dompet?"
          description={`Dompet "${deleting.account.name}" akan dihapus dari daftar.`}
          submitLabel="Hapus dompet"
          destructive
          submitting={saving}
          onClose={() => setDeleting(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void submitDelete();
          }}
        >
          <p className="text-sm text-slate-600">
            Dompet kosong akan dihapus permanen dari database. Dompet yang
            memiliki transaksi, transfer, atau catatan pinjaman tidak dapat
            dihapus.
          </p>
        </ActionModal>
      )}
      {(error || notice) && (
        <Snackbar
          message={error || notice}
          tone={error ? "error" : "success"}
          onClose={() => {
            setError("");
            setNotice("");
          }}
        />
      )}
    </AppShell>
  );
}
