import { NextResponse } from "next/server";

function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{1,6}\.JK$/.test(symbol);
}

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase();
  if (!symbol || !isValidSymbol(symbol)) {
    return NextResponse.json(
      { error: "Simbol saham BEI tidak valid." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: "Harga saham tidak tersedia dari provider." },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number; currency?: string };
        }>;
      };
    };
    const meta = payload.chart?.result?.[0]?.meta;
    if (
      typeof meta?.regularMarketPrice !== "number" ||
      meta.currency !== "IDR"
    ) {
      return NextResponse.json(
        {
          error: "Provider tidak mengembalikan harga IDR untuk saham tersebut.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      symbol,
      price: meta.regularMarketPrice,
      currency: meta.currency,
      updatedAt: new Date().toISOString(),
    });
  } catch (reason) {
    console.error("Permintaan harga saham gagal:", reason);
    return NextResponse.json(
      { error: "Provider harga saham tidak dapat dijangkau." },
      { status: 502 },
    );
  }
}
