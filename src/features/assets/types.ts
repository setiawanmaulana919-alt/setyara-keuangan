import type { Asset } from "@/types/data-model";

export interface AssetSummary {
  asset: Asset;
  currentValue: number;
  valuedAt?: string;
}
