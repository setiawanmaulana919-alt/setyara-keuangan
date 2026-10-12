import { NextResponse } from "next/server";

const GOLD_API =
  "https://logam-mulia-api.iamutaki.workers.dev/api/prices/logammulia";

export async function GET(request: Request) {
  const source =
    new URL(request.url).searchParams.get("source")?.trim().toLowerCase() ??
    "antam";
  if (source !== "antam") {
    return NextResponse.json(
      { error: "Sumber harga emas tidak valid." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(GOLD_API, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Harga emas tidak tersedia dari provider." },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{
        weight?: number;
        sellPrice?: number;
        currency?: string;
      }>;
    };
    const item = payload.data?.find(
      (entry) =>
        entry.weight === 1 &&
        entry.currency === "IDR" &&
        typeof entry.sellPrice === "number",
    );
    if (!item || typeof item.sellPrice !== "number") {
      return NextResponse.json(
        { error: "Provider tidak mengembalikan harga emas per gram." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      symbol: "antam",
      price: item.sellPrice,
      currency: "IDR",
      unit: "gram",
      updatedAt: new Date().toISOString(),
    });
  } catch (reason) {
    console.error("Permintaan harga emas gagal:", reason);
    return NextResponse.json(
      { error: "Provider harga emas tidak dapat dijangkau." },
      { status: 502 },
    );
  }
}
