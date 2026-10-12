import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Asset, AssetValuation } from "@/types/data-model";
import {
  id,
  ASSET_COLUMNS,
  ASSET_VALUATION_COLUMNS,
  assertPositiveInteger,
  assertDate,
  currentUserId,
} from "@/features/finance/api/shared";
import type { AssetSummary } from "@/features/assets/types";

export async function createAsset(input: {
  name: string;
  assetType: string;
  acquisitionValue: number;
}): Promise<Asset> {
  if (!input.name.trim() || !input.assetType.trim()) {
    throw new Error("Nama dan tipe aset wajib diisi.");
  }
  assertPositiveInteger(input.acquisitionValue, "acquisitionValue");
  const userId = await currentUserId();
  const { data, error } = await getSupabaseBrowserClient()
    .from("assets")
    .insert({
      id: id(),
      owner_user_id: userId,
      name: input.name.trim(),
      asset_type: input.assetType,
      acquisition_value: input.acquisitionValue,
    })
    .select(ASSET_COLUMNS)
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    ownerUserId: userId,
    scopeType: "personal",
    name: String(data.name),
    assetType: String(data.asset_type),
    acquisitionValue: Number(data.acquisition_value),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}

export async function addAssetValuation(input: {
  assetId: string;
  valuationDate: string;
  marketValue: number;
}): Promise<AssetValuation> {
  const { data: asset, error: assetError } = await getSupabaseBrowserClient()
    .from("assets")
    .select("id")
    .eq("id", input.assetId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("Aset tidak ditemukan.");
  assertDate(input.valuationDate, "valuationDate");
  assertPositiveInteger(input.marketValue, "marketValue");
  const { data, error } = await getSupabaseBrowserClient()
    .from("asset_valuation_history")
    .insert({
      id: id(),
      asset_id: input.assetId,
      valuation_date: input.valuationDate,
      market_value: input.marketValue,
    })
    .select(ASSET_VALUATION_COLUMNS)
    .single();
  if (error) throw error;
  return {
    id: String(data.id),
    assetId: String(data.asset_id),
    valuationDate: String(data.valuation_date),
    marketValue: Number(data.market_value),
    createdAt: String(data.created_at),
    updatedAt: String(data.created_at),
  };
}

export async function listAssetSummaries(): Promise<AssetSummary[]> {
  const { data, error } = await getSupabaseBrowserClient().rpc(
    "list_asset_summaries",
  );
  if (error) throw error;
  if (!Array.isArray(data)) {
    throw new Error("Respons ringkasan aset dari Supabase tidak valid.");
  }
  return data.map((row) => {
    const asset: Asset = {
      id: String(row.id),
      ownerUserId: String(row.owner_user_id),
      scopeType: "personal",
      name: String(row.name),
      assetType: String(row.asset_type),
      acquisitionValue: Number(row.acquisition_value),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
    const currentValue =
      row.market_value === null
        ? asset.acquisitionValue
        : Number(row.market_value);
    if (!Number.isFinite(currentValue)) {
      throw new Error("Supabase mengembalikan nilai aset yang tidak valid.");
    }
    return {
      asset,
      currentValue,
      ...(typeof row.valuation_date === "string"
        ? { valuedAt: row.valuation_date }
        : {}),
    };
  });
}
