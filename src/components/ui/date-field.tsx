"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  mode?: "date" | "month";
  min?: string;
  max?: string;
  required?: boolean;
  "aria-label"?: string;
  className?: string;
}

interface PopupPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const monthNameFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
});
const weekdays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function dateToString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseCalendarValue(value: string, mode: "date" | "month"): Date {
  if (mode === "month" && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return new Date(year, month - 1, 1);
  }
  if (mode === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatValue(value: string, mode: "date" | "month"): string {
  if (!value) return "";
  const date = parseCalendarValue(value, mode);
  return mode === "month"
    ? monthFormatter.format(date)
    : dateFormatter.format(date);
}

export function DateField({
  value,
  onChange,
  mode = "date",
  min,
  max,
  required = false,
  "aria-label": ariaLabel,
  className = "",
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopupPosition | null>(null);
  const calendarId = useId();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    parseCalendarValue(value, mode),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 32);
      const left = Math.max(
        16,
        Math.min(rect.left, window.innerWidth - width - 16),
      );
      const preferredHeight = mode === "month" ? 330 : 390;
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 16);
      const spaceAbove = Math.max(0, rect.top - 16);
      const placeBelow =
        spaceBelow >= Math.min(preferredHeight, 240) ||
        spaceBelow >= spaceAbove;
      const maxHeight = Math.min(
        preferredHeight,
        placeBelow ? spaceBelow : spaceAbove,
      );
      const top = placeBelow ? rect.bottom + 6 : rect.top - maxHeight - 6;
      setPosition({ top: Math.max(8, top), left, width, maxHeight });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.focus();
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
  }, [mode, open]);

  function openPicker() {
    setVisibleMonth(parseCalendarValue(value, mode));
    setOpen((current) => !current);
  }

  const monthStart = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  );
  const firstWeekdayOffset = (monthStart.getDay() + 6) % 7;
  const calendarStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - firstWeekdayOffset,
  );
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      calendarStart.getFullYear(),
      calendarStart.getMonth(),
      calendarStart.getDate() + index,
    );
    const dateValue = dateToString(date);
    return {
      date,
      value: dateValue,
      currentMonth: date.getMonth() === visibleMonth.getMonth(),
      disabled:
        (min !== undefined && dateValue < min) ||
        (max !== undefined && dateValue > max),
    };
  });

  function changeMonth(offset: number) {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  return (
    <div className={`relative mt-1.5 w-full min-w-0 max-w-full ${className}`}>
      {required && (
        <input
          aria-hidden="true"
          tabIndex={-1}
          type={mode}
          required
          min={min}
          max={max}
          value={value}
          onChange={() => undefined}
          onInvalid={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
            setOpen(true);
          }}
          className="pointer-events-none absolute left-1 top-1 h-px w-px opacity-0"
        />
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          readOnly
          value={formatValue(value, mode)}
          placeholder={mode === "month" ? "Pilih bulan" : "Pilih tanggal"}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-controls={calendarId}
          aria-expanded={open}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          className="field mt-0 w-full min-w-0 cursor-pointer pr-10"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
          <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" />
        </svg>
      </div>
      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Tutup kalender"
              onMouseDown={(event) => {
                event.preventDefault();
                setOpen(false);
              }}
              className="fixed inset-0 z-[60] cursor-default bg-transparent"
            />
            <div
              id={calendarId}
              role="dialog"
              aria-label={ariaLabel ?? "Pilih tanggal"}
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
              className="fixed z-[61] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgb(15_23_42/0.18)]"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  aria-label="Bulan sebelumnya"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100"
                >
                  ‹
                </button>
                <p className="text-sm font-semibold text-slate-800">
                  {monthFormatter.format(visibleMonth)}
                </p>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  aria-label="Bulan berikutnya"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100"
                >
                  ›
                </button>
              </div>
              {mode === "month" ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 12 }, (_, index) => {
                    const monthDate = new Date(
                      visibleMonth.getFullYear(),
                      index,
                      1,
                    );
                    const monthValue = `${visibleMonth.getFullYear()}-${String(index + 1).padStart(2, "0")}`;
                    const isSelected = value === monthValue;
                    const outsideRange =
                      (min !== undefined && monthValue < min.slice(0, 7)) ||
                      (max !== undefined && monthValue > max.slice(0, 7));
                    return (
                      <button
                        key={monthValue}
                        type="button"
                        disabled={outsideRange}
                        onClick={() => {
                          onChange(monthValue);
                          setOpen(false);
                        }}
                        className={`rounded-lg px-2 py-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {monthNameFormatter.format(monthDate)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="mb-1 grid grid-cols-7">
                    {weekdays.map((weekday) => (
                      <span
                        key={weekday}
                        className="py-2 text-center text-[10px] font-semibold uppercase text-slate-400"
                      >
                        {weekday}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-1">
                    {days.map((day) => {
                      const isSelected = value === day.value;
                      const isToday = dateToString(new Date()) === day.value;
                      return (
                        <button
                          key={day.value}
                          type="button"
                          disabled={day.disabled}
                          aria-pressed={isSelected}
                          onClick={() => {
                            onChange(day.value);
                            setOpen(false);
                          }}
                          className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs transition disabled:cursor-not-allowed disabled:opacity-25 ${
                            isSelected
                              ? "bg-blue-600 font-semibold text-white"
                              : isToday
                                ? "font-semibold text-blue-700 ring-1 ring-blue-200"
                                : day.currentMonth
                                  ? "text-slate-700 hover:bg-slate-100"
                                  : "text-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {day.date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
