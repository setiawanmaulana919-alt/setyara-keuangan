export function PageLoading({
  label = "Memuat data cloud...",
}: {
  label?: string;
}) {
  return (
    <div
      className="mt-6 space-y-4"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}
