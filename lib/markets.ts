import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { markets } from "@/db/schema";
import type { KalshiMarket } from "@/lib/kalshi";

const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

function cachedFields(m: KalshiMarket) {
  return {
    eventTicker: m.eventTicker,
    title: m.title,
    yesSubTitle: m.yesSubTitle,
    yesBid: m.yesBid,
    yesAsk: m.yesAsk,
    status: m.status,
    result: m.result,
    closeTs: m.closeTime ? new Date(m.closeTime) : null,
    updatedAt: new Date(),
  };
}

/** Upsert a freshly-fetched Kalshi market into the D1 cache. */
export async function cacheMarket(m: KalshiMarket): Promise<void> {
  const db = getDb();
  const fields = cachedFields(m);
  await db
    .insert(markets)
    .values({ ticker: m.ticker, ...fields })
    .onConflictDoUpdate({ target: markets.ticker, set: fields });
}

/** Persist the picker results without allowing duplicate tickers to fan out. */
export async function cacheMarkets(items: KalshiMarket[]): Promise<void> {
  const unique = [...new Map(items.map((market) => [market.ticker, market])).values()];
  if (unique.length === 0) return;
  const db = getDb();
  const statements = unique.map((market) => {
    const fields = cachedFields(market);
    return db
      .insert(markets)
      .values({ ticker: market.ticker, ...fields })
      .onConflictDoUpdate({ target: markets.ticker, set: fields });
  });
  for (let index = 0; index < statements.length; index += 50) {
    const batch = statements.slice(index, index + 50) as [
      (typeof statements)[number],
      ...(typeof statements)[number][],
    ];
    await db.batch(batch);
  }
}

/**
 * Read a recent quote persisted by discovery or the live-price proxy. This is
 * only a display/availability fallback; actions still call Kalshi before a
 * friend locks a stake.
 */
export async function getCachedMarket(ticker: string): Promise<KalshiMarket | null> {
  const db = getDb();
  const rows = await db.select().from(markets).where(eq(markets.ticker, ticker)).limit(1);
  const market = rows[0];
  if (!market || Date.now() - market.updatedAt.getTime() > CACHE_MAX_AGE_MS) return null;

  return {
    ticker: market.ticker,
    eventTicker: market.eventTicker ?? "",
    title: market.title,
    yesSubTitle: market.yesSubTitle,
    yesBid: market.yesBid,
    yesAsk: market.yesAsk,
    noBid: Math.max(0, 1 - market.yesAsk),
    noAsk: Math.min(1, 1 - market.yesBid),
    yesMid: (market.yesBid + market.yesAsk) / 2,
    status: market.status,
    result: market.result,
    closeTime: market.closeTs?.toISOString() ?? null,
    liquidity: 0,
    volume24h: 0,
  };
}
