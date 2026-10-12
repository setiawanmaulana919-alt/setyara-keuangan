"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const { url, anonKey } = getSupabaseConfig();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
