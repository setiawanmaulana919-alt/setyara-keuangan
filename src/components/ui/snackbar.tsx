"use client";

import { useEffect } from "react";

export function Snackbar({
  message,
  tone = "success",
  onClose,
  actionLabel,
  onAction,
}: {
  message: string;
  tone?: "success" | "error";
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  useEffect(() => {
    if (!onClose) return;
    const timer = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-xl sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:right-auto sm:mx-0 sm:-translate-x-1/2 lg:absolute ${
        tone === "error" ? "bg-rose-600" : "bg-emerald-600"
      }`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold"
        aria-hidden="true"
      >
        {tone === "error" ? "!" : "✓"}
      </span>
      <span className="min-w-0 flex-1">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
        >
          {actionLabel}
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup notifikasi"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg leading-none text-white/80 hover:bg-white/15 hover:text-white"
        >
          ×
        </button>
      )}
    </div>
  );
}
