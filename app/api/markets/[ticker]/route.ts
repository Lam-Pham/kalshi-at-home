import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchMarket, type KalshiMarket } from "@/lib/kalshi";
import { cacheMarket, getCachedMarket } from "@/lib/markets";

export const dynamic = "force-dynamic";

const TickerSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/, "invalid ticker");

// ~3s in-memory cache per isolate. At friends scale this is plenty — no
// Durable Object or cron needed (see PROJECT-PLAN.md "Live odds").
const CACHE_TTL_MS = 3000;
const cache = new Map<string, { data: KalshiMarket; fetchedAt: number }>();

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker: raw } = await ctx.params;
  const parsed = TickerSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid ticker" }, { status: 400 });
  }
  const ticker = parsed.data;
  const now = Date.now();

  const hit = cache.get(ticker);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ market: hit.data, source: "cache", fetchedAt: hit.fetchedAt });
  }

  try {
    const market = await fetchMarket(ticker);
    cache.set(ticker, { data: market, fetchedAt: now });
    await cacheMarket(market); // persist to D1 — proves CF runtime → D1 → Drizzle
    return NextResponse.json({ market, source: "live", fetchedAt: now });
  } catch (err) {
    // Transient Kalshi failure: serve the last good value if we have one.
    if (hit) {
      return NextResponse.json({ market: hit.data, source: "stale", fetchedAt: hit.fetchedAt });
    }
    const persisted = await getCachedMarket(ticker);
    if (persisted) {
      return NextResponse.json({ market: persisted, source: "persisted", fetchedAt: now });
    }
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
