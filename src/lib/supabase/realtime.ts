import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { RealtimeChannel } from "@supabase/supabase-js";

type SyncEntity =
  "wallets" | "categories" | "financial_transactions" | "wallet_transfers";

const entities: SyncEntity[] = [
  "wallets",
  "categories",
  "financial_transactions",
  "wallet_transfers",
];

let pendingCloudUpdate: number | undefined;

export function subscribeToCloudChanges(
  onError: (error: Error) => void,
): () => void {
  const client = getSupabaseBrowserClient();
  let channel: RealtimeChannel | null = client.channel("keuangan-cloud-sync");

  for (const entity of entities) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: entity },
      () => {
        if (typeof window === "undefined" || pendingCloudUpdate !== undefined)
          return;
        pendingCloudUpdate = window.setTimeout(() => {
          pendingCloudUpdate = undefined;
          window.dispatchEvent(new Event("cloud-sync-updated"));
        }, 150);
      },
    );
  }

  void channel.subscribe((status, error) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      onError(error ?? new Error(`Realtime Supabase: ${status}`));
    }
  });

  return () => {
    if (pendingCloudUpdate !== undefined && typeof window !== "undefined") {
      window.clearTimeout(pendingCloudUpdate);
      pendingCloudUpdate = undefined;
    }
    if (channel) void client.removeChannel(channel);
  };
}
