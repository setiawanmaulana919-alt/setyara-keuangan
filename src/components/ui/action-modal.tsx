"use client";

interface ActionModalProps {
  title: string;
  description?: string;
  submitLabel: string;
  destructive?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}

export function ActionModal({
  title,
  description,
  submitLabel,
  destructive = false,
  submitting = false,
  onClose,
  onSubmit,
  children,
}: ActionModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-[2px] sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-modal-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/80 bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
                destructive
                  ? "bg-rose-50 text-rose-600"
                  : "bg-blue-50 text-blue-600"
              }`}
            >
              <span className="text-lg font-bold">
                {destructive ? "!" : "+"}
              </span>
            </div>
            <h2
              id="action-modal-title"
              className="text-xl font-bold tracking-tight text-slate-950"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ×
          </button>
        </div>
        <div className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 sm:p-5">
          {children}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
              destructive
                ? "bg-rose-600 shadow-rose-600/20 hover:bg-rose-700"
                : "bg-blue-600 shadow-blue-600/20 hover:bg-blue-700"
            }`}
          >
            {submitting ? "Menyimpan..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
