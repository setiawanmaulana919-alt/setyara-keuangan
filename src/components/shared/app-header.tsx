"use client";

import { AppShell } from "./app-shell";

export function AppHeader({
  current = "dashboard",
  children,
}: {
  current?: "dashboard" | "family";
  children?: React.ReactNode;
}) {
  return <AppShell current={current}>{children}</AppShell>;
}
