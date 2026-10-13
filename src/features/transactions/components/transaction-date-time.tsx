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
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium leading-4 text-slate-500 tabular-nums">
      <time dateTime={transactionDate} aria-label={fullDate} title={fullDate}>
        {compactDateFormatter.format(date)}
      </time>
      <span aria-hidden="true" className="text-slate-300">
        ·
      </span>
      <time
        dateTime={recordedAt}
        aria-label={`Dicatat pukul ${timeFormatter.format(recordedDate)}`}
      >
        {timeFormatter.format(recordedDate)}
      </time>
    </span>
  );
}
