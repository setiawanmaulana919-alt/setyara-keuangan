"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  "aria-label"?: string;
  className?: string;
}

interface PopupPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

function padTimePart(value: number): string {
  return String(value).padStart(2, "0");
}

function getLocalTime(): string {
  const now = new Date();
  return `${padTimePart(now.getHours())}:${padTimePart(now.getMinutes())}`;
}

function isWithinRange(time: string, min?: string, max?: string): boolean {
  return (!min || time >= min) && (!max || time <= max);
}

export function TimeField({
  value,
  onChange,
  min,
  max,
  "aria-label": ariaLabel,
  className = "",
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState(value || "00:00");
  const [position, setPosition] = useState<PopupPosition | null>(null);
  const pickerId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const hasCenteredInitialTime = useRef(false);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(
        Math.max(rect.width, 240),
        320,
        window.innerWidth - 32,
      );
      const left = Math.max(
        16,
        Math.min(rect.left, window.innerWidth - width - 16),
      );
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 16);
      const spaceAbove = Math.max(0, rect.top - 16);
      const maxHeight = Math.min(
        300,
        Math.max(spaceBelow, spaceAbove),
        window.innerHeight - 32,
      );
      const placeBelow = spaceBelow >= Math.min(280, maxHeight);
      const top = placeBelow ? rect.bottom + 6 : rect.top - maxHeight - 6;
      setPosition({ top: Math.max(8, top), left, width, maxHeight });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !position) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const picker = pickerRef.current?.getBoundingClientRect();
    if (!trigger || !picker) return;
    const spaceBelow = Math.max(0, window.innerHeight - trigger.bottom - 16);
    const placeBelow = spaceBelow >= Math.min(280, position.maxHeight);
    const top = placeBelow
      ? trigger.bottom + 6
      : trigger.top - picker.height - 6;
    const nextTop = Math.max(8, top);
    if (Math.abs(position.top - nextTop) > 1) {
      setPosition((current) =>
        current ? { ...current, top: nextTop } : current,
      );
    }
  }, [open, position]);

  useLayoutEffect(() => {
    if (!open) {
      hasCenteredInitialTime.current = false;
      return;
    }
    if (!position || hasCenteredInitialTime.current) return;

    for (const list of [hourListRef.current, minuteListRef.current]) {
      const selected = list?.querySelector<HTMLElement>(
        '[aria-pressed="true"]',
      );
      if (!list || !selected) continue;
      const listRect = list.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      list.scrollTop +=
        selectedRect.top -
        listRect.top -
        (list.clientHeight - selectedRect.height) / 2;
    }
    hasCenteredInitialTime.current = true;
  }, [open, position]);

  function openPicker() {
    const initialTime = value || getLocalTime();
    setSelectedTime(
      min && initialTime < min
        ? min
        : max && initialTime > max
          ? max
          : initialTime,
    );
    setOpen((current) => !current);
  }

  function changePart(part: "hour" | "minute", nextValue: number) {
    const [currentHour, currentMinute] = selectedTime.split(":").map(Number);
    const nextTime =
      part === "hour"
        ? `${padTimePart(nextValue)}:${padTimePart(currentMinute)}`
        : `${padTimePart(currentHour)}:${padTimePart(nextValue)}`;
    if (!isWithinRange(nextTime, min, max)) return;
    setSelectedTime(nextTime);
    onChange(nextTime);
  }

  const [selectedHour, selectedMinute] = selectedTime.split(":").map(Number);

  return (
    <div className="mt-1.5 w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        aria-controls={pickerId}
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) openPicker();
          }
        }}
        className={`field date-time-control !flex mt-0 w-full min-w-0 cursor-pointer items-center justify-between gap-3 text-left ${className}`}
      >
        <span className={value ? "tabular-nums" : "text-slate-400"}>
          {value || "Pilih jam"}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-4 w-4 shrink-0 text-slate-400"
        >
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      </button>
      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Tutup pemilih jam"
              onMouseDown={(event) => {
                event.preventDefault();
                setOpen(false);
              }}
              className="fixed inset-0 z-[60] cursor-default bg-transparent"
            />
            <div
              ref={pickerRef}
              id={pickerId}
              role="dialog"
              aria-label={ariaLabel ?? "Pilih jam"}
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
              className="fixed z-[61] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_40px_rgb(15_23_42/0.18)]"
            >
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pilih jam
              </p>
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
                {(["hour", "minute"] as const).map((part) => {
                  const selected =
                    part === "hour" ? selectedHour : selectedMinute;
                  const listRef = part === "hour" ? hourListRef : minuteListRef;
                  const values = Array.from(
                    { length: part === "hour" ? 24 : 60 },
                    (_, index) => index,
                  );
                  return (
                    <div
                      key={part}
                      aria-label={part === "hour" ? "Jam" : "Menit"}
                      ref={listRef}
                      className="time-picker-options min-h-0 overflow-y-auto rounded-xl bg-slate-50 p-1"
                    >
                      {values.map((item) => {
                        const nextTime =
                          part === "hour"
                            ? `${padTimePart(item)}:${padTimePart(selectedMinute)}`
                            : `${padTimePart(selectedHour)}:${padTimePart(item)}`;
                        const disabled = !isWithinRange(nextTime, min, max);
                        return (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={selected === item}
                            disabled={disabled}
                            onClick={() => changePart(part, item)}
                            className={`min-h-9 w-full rounded-lg px-2 text-sm tabular-nums transition ${
                              selected === item
                                ? "bg-blue-600 font-semibold text-white"
                                : "text-slate-700 hover:bg-white"
                            } disabled:cursor-not-allowed disabled:opacity-35`}
                          >
                            {padTimePart(item)}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between gap-2 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    triggerRef.current?.focus({ preventScroll: true });
                  }}
                  className="min-h-9 rounded-lg px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  Hapus
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus({ preventScroll: true });
                  }}
                  className="min-h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Selesai · {selectedTime}
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
