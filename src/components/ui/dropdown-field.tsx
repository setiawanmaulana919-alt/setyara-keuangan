"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface OptionProps {
  value?: string;
  disabled?: boolean;
  children?: ReactNode;
}

interface DropdownFieldProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
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

function collectDropdownOptions(nodes: ReactNode): Array<{
  value: string;
  label: ReactNode;
  disabled: boolean;
}> {
  return Children.toArray(nodes).flatMap((child) => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type === Fragment) {
      return collectDropdownOptions(child.props.children);
    }
    if (child.type !== "option") return [];
    return [
      {
        value: child.props.value ?? "",
        label: child.props.children,
        disabled: child.props.disabled ?? false,
      },
    ];
  });
}

export function DropdownField({
  value,
  onChange,
  children,
  disabled = false,
  required = false,
  "aria-label": ariaLabel,
  className = "",
}: DropdownFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<PopupPosition | null>(null);
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const options = useMemo(() => collectDropdownOptions(children), [children]);
  const selected = options.find((option) => option.value === value);
  const filteredOptions = options.filter((option) =>
    typeof option.label === "string"
      ? option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())
      : true,
  );

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(
        Math.max(rect.width, 240),
        360,
        window.innerWidth - 32,
      );
      const left = Math.max(
        16,
        Math.min(rect.left, window.innerWidth - width - 16),
      );
      const preferredHeight = Math.min(320, window.innerHeight - 32);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 16);
      const spaceAbove = Math.max(0, rect.top - 16);
      const placeBelow =
        spaceBelow >= Math.min(preferredHeight, 180) ||
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
        setSearch("");
        triggerRef.current?.focus();
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

  function toggle() {
    if (disabled) return;
    setOpen((current) => !current);
    setSearch("");
  }

  return (
    <div className={`relative mt-1.5 w-full min-w-0 ${className}`}>
      {required && (
        <select
          aria-hidden="true"
          tabIndex={-1}
          required
          value={value}
          onChange={() => undefined}
          onInvalid={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
            setOpen(true);
          }}
          className="pointer-events-none absolute left-1 top-1 h-px w-px opacity-0"
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      )}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-required={required}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm text-slate-800 shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition hover:border-slate-300 focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <span className={selected ? "truncate" : "truncate text-slate-400"}>
          {selected?.label ||
            (required ? "Pilih opsi" : "Pilih opsi (opsional)")}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
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
              aria-label="Tutup daftar pilihan"
              onMouseDown={(event) => {
                event.preventDefault();
                setOpen(false);
                setSearch("");
              }}
              className="fixed inset-0 z-[60] cursor-default bg-transparent"
            />
            <div
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
              className="fixed z-[61] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgb(15_23_42/0.18)]"
            >
              {options.length > 8 && (
                <input
                  type="search"
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari pilihan..."
                  aria-label="Cari pilihan"
                  className="mb-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-50"
                />
              )}
              <div
                id={listboxId}
                role="listbox"
                aria-label={ariaLabel}
                className="overflow-y-auto"
                style={{
                  maxHeight:
                    position.maxHeight - (options.length > 8 ? 54 : 12),
                }}
              >
                {filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    disabled={option.disabled}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearch("");
                      triggerRef.current?.focus();
                    }}
                    className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                      option.value === value
                        ? "bg-blue-50 font-semibold text-blue-700"
                        : "text-slate-700"
                    }`}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {option.value === value && (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="none"
                        className="h-4 w-4 shrink-0"
                      >
                        <path
                          d="m4 10 4 4 8-8"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    )}
                  </button>
                ))}
                {filteredOptions.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-slate-500">
                    Tidak ada pilihan yang cocok.
                  </p>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
