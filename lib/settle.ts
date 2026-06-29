import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offers, markets } from "@/db/schema";
import { fetchMarket } from "@/lib/kalshi";
import { cacheMarket } from "@/lib/markets";

/**
 * Lazy settlement, run on every room load (v1 has no background jobs). For the
 * markets behind still-live offers, refresh any that have *closed* but whose
 * result we don't yet know, then flip offers whose market resolved to "settled".
 * Balances are derived from settled offers downstream — we only move statuses.
 *
 * We deliberately re-fetch only closed-but-unknown markets: a market can't have
 * a result before it closes, so open markets need no Kalshi call here.
 */
export async function settleRoom(groupId: string): Promise<void> {
  const db = getDb();
  const live = await db
    .select()
    .from(offers)
    .where(and(eq(offers.groupId, groupId), inArray(offers.status, ["open", "closed"])));
  if (live.length === 0) return;

  const tickers = [...new Set(live.map((o) => o.marketTicker))];
  const cachedRows = await db.select().from(markets).where(inArray(markets.ticker, tickers));
  const cached = new Map(cachedRows.map((m) => [m.ticker, m]));
  const now = Date.now();

  const toCheck = tickers.filter((t) => {
    const m = cached.get(t);
    if (!m) return true; // never cached → check it
    if (m.result === "yes" || m.result === "no") return false; // already resolved
    if (m.closeTs && m.closeTs.getTime() > now) return false; // not closed → can't be resolved
    return true;
  });

  const fresh = await Promise.all(
    toCheck.map(async (t) => {
      try {
        const m = await fetchMarket(t);
        await cacheMarket(m);
        return m;
      } catch {
        return null; // transient Kalshi failure — try again next load
      }
    }),
  );

  const resolved = new Map<string, string>();
  for (const m of cachedRows) if (m.result === "yes" || m.result === "no") resolved.set(m.ticker, m.result);
  for (const m of fresh) if (m && (m.result === "yes" || m.result === "no")) resolved.set(m.ticker, m.result);

  const settleIds = live
    .filter((o) => resolved.has(o.marketTicker))
    .map((o) => o.id);
  if (settleIds.length > 0) {
    await db.update(offers).set({ status: "settled" }).where(inArray(offers.id, settleIds));
  }
}
