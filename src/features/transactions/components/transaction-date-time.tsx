"use client";

import { useMemo, useSyncExternalStore } from "react";

const subscribeToTimeZone = () => () => {};
const getTimeZoneSnapshot = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTimeZoneSnapshot = () => "UTC";

const fullDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const compactDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function TransactionDateTime({
  transactionDate,
  recordedAt,
}: {
  transactionDate: string;
  recordedAt: string;
}) {
  const timeZone = useSyncExternalStore(
    subscribeToTimeZone,
    getTimeZoneSnapshot,
    getServerTimeZoneSnapshot,
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    [timeZone],
  );
  const date = new Date(`${transactionDate}T00:00:00Z`);
  const recordedDate = new Date(recordedAt);
  const fullDate = fullDateFormatter.format(date);

  return (
    <span className="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-[11px] font-medium leading-4 tabular-nums">
      <time
        dateTime={transactionDate}
        aria-label={fullDate}
        title={fullDate}
        className="text-slate-500"
      >
        {compactDateFormatter.format(date)}
      </time>
      <span aria-hidden="true" className="text-slate-300">
        ·
      </span>
      <time
        dateTime={recordedAt}
        aria-label={`Dicatat pukul ${timeFormatter.format(recordedDate)}`}
        className="text-slate-600"
      >
        {timeFormatter.format(recordedDate)}
      </time>
    </span>
  );
}
