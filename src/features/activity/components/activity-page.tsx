"use client";

import { AppShell } from "@/components/shared/app-shell";
import { TransactionList } from "@/features/activity/components/transaction-list";
import { PageLoading } from "@/components/ui/page-loading";
import { ActionModal } from "@/components/ui/action-modal";
import { Snackbar } from "@/components/ui/snackbar";
import { useActivity } from "@/features/activity/hooks/use-activity";

export default function ActivityPage() {
  const {
    transactions,
    accounts,
    categories,
    search,
    message,
    setMessage,
    error,
    setError,
    loading,
    transactionsLoading,
    page,
    hasNextPage,
    deleting,
    setDeleting,
    deletingBusy,
    pageSize,
    onSearchChange,
    onPageChange,
    removeTransaction,
  } = useActivity();

  return (
    <AppShell current="activity">
      <div className="py-6 sm:py-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Activity
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Semua aktivitas keuanganmu, tersusun rapi dalam satu daftar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-quick-add"))}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0071e3] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0066cc]"
          >
            + Tambah transaksi
          </button>
        </div>

        {loading ? (
          <PageLoading label="Memuat aktivitas dari Supabase..." />
        ) : (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgb(15_23_42/0.03)] sm:p-6">
            <TransactionList
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              search={search}
              page={page}
              pageSize={pageSize}
              hasNextPage={hasNextPage}
              loading={transactionsLoading}
              onSearchChange={onSearchChange}
              onPageChange={onPageChange}
              onEdit={(transaction) =>
                window.dispatchEvent(
                  new CustomEvent("open-quick-add-edit", {
                    detail: transaction,
                  }),
                )
              }
              onDelete={(transaction) => setDeleting(transaction)}
            />
          </section>
        )}
      </div>
      {(message || error) && (
        <Snackbar
          message={error || message}
          tone={error ? "error" : "success"}
          onClose={() => {
            setMessage("");
            setError("");
          }}
        />
      )}
      {deleting && (
        <ActionModal
          title="Hapus transaksi?"
          description="Transaksi ini akan dihapus permanen dari database."
          submitLabel="Hapus transaksi"
          destructive
          submitting={deletingBusy}
          onClose={() => setDeleting(null)}
          onSubmit={(event) => {
            event.preventDefault();
            void removeTransaction(deleting).then((success) => {
              if (success) setDeleting(null);
            });
          }}
        >
          <p>
            Data transaksi akan dihapus permanen dari database. Tindakan ini
            tidak dapat dibatalkan dan tidak memengaruhi transaksi lainnya.
          </p>
        </ActionModal>
      )}
    </AppShell>
  );
}
