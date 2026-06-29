import { getDb } from "@/lib/db";
import { markets } from "@/db/schema";
import type { KalshiMarket } from "@/lib/kalshi";

/** Upsert a freshly-fetched Kalshi market into the D1 cache. */
export async function cacheMarket(m: KalshiMarket): Promise<void> {
  const db = getDb();
  const fields = {
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
  await db
    .insert(markets)
    .values({ ticker: m.ticker, ...fields })
    .onConflictDoUpdate({ target: markets.ticker, set: fields });
}
