import { NextResponse } from "next/server";

function isValidSymbol(symbol: string): boolean {
  return /^[a-z0-9]{2,20}_idr$/.test(symbol);
}

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.toLowerCase();
  if (!symbol || !isValidSymbol(symbol)) {
    return NextResponse.json(
      { error: "Pasangan crypto IDR tidak valid." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `https://indodax.com/api/ticker/${encodeURIComponent(symbol)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: "Harga crypto tidak tersedia dari INDODAX." },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as {
      ticker?: { last?: string | number };
    };
    const price = Number(payload.ticker?.last);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: "Provider tidak mengembalikan harga crypto yang valid." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      symbol,
      price,
      currency: "IDR",
      updatedAt: new Date().toISOString(),
    });
  } catch (reason) {
    console.error("Permintaan harga crypto gagal:", reason);
    return NextResponse.json(
      { error: "Provider harga crypto tidak dapat dijangkau." },
      { status: 502 },
    );
  }
}
