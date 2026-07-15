import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { offers, fills, markets, settlements } from "@/db/schema";
import { getMembers } from "@/lib/session";
import {
  oppositeSide,
  makerRiskForStake,
  remainingBudget,
  spentBudget,
  computeBalances,
  applySettlements,
  settleUp,
  roundCents,
  type Side,
  type Transfer,
} from "@/lib/bets";
import type { Group, PublicMember, Offer, Market, Fill } from "@/db/schema";

export interface FillView {
  fill: Fill;
  taker: PublicMember | null;
  takerSide: Side;
  /** What the taker stands to win on top of their stake (matched maker risk). */
  takerWin: number;
}

export interface OfferView {
  offer: Offer;
  maker: PublicMember | null;
  market: Market | null;
  fills: FillView[];
  spent: number;
  remaining: number;
  /** Kalshi result once settled, else "". */
  result: Side | "";
}

export interface LeaderRow {
  member: PublicMember;
  balance: number;
}

export interface RoomData {
  members: PublicMember[];
  all: OfferView[];
  open: OfferView[];
  live: OfferView[];
  settled: OfferView[];
  leaderboard: LeaderRow[];
  transfers: Transfer[];
  hasSettled: boolean;
}

function buildOfferView(
  offer: Offer,
  memberById: Map<string, PublicMember>,
  marketByTicker: Map<string, Market>,
  fillsByOffer: Map<string, Fill[]>,
): OfferView {
  const makerSide = offer.side as Side;
  const takerSide = oppositeSide(makerSide);
  const market = marketByTicker.get(offer.marketTicker) ?? null;
  const offerFills = fillsByOffer.get(offer.id) ?? [];

  const fillViews: FillView[] = offerFills.map((f) => ({
    fill: f,
    taker: memberById.get(f.takerId) ?? null,
    takerSide,
    takerWin: roundCents(makerRiskForStake(f.stake, f.lockedYesPrice, takerSide)),
  }));

  const priced = offerFills.map((f) => ({ stake: f.stake, yesPrice: f.lockedYesPrice }));
  const result = market && (market.result === "yes" || market.result === "no") ? market.result : "";

  return {
    offer,
    maker: memberById.get(offer.makerId) ?? null,
    market,
    fills: fillViews,
    spent: roundCents(spentBudget(makerSide, priced)),
    remaining: roundCents(remainingBudget(offer.maxRisk, makerSide, priced)),
    result,
  };
}

/**
 * Everything the room screen renders: members, the three offer buckets,
 * the derived leaderboard, and the minimal settle-up transfers. Call
 * `settleRoom` first so statuses and market results are fresh.
 */
export async function getRoomData(group: Group): Promise<RoomData> {
  const db = getDb();

  const members = await getMembers(group.id);
  const offerRows = await db
    .select()
    .from(offers)
    .where(eq(offers.groupId, group.id))
    .orderBy(desc(offers.createdAt));

  const offerIds = offerRows.map((o) => o.id);
  const tickers = [...new Set(offerRows.map((o) => o.marketTicker))];
  const [fillRows, marketRows, settlementRows] = await Promise.all([
    offerIds.length
      ? db.select().from(fills).where(inArray(fills.offerId, offerIds)).orderBy(asc(fills.createdAt))
      : Promise.resolve([] as Fill[]),
    tickers.length
      ? db.select().from(markets).where(inArray(markets.ticker, tickers))
      : Promise.resolve([] as Market[]),
    db.select().from(settlements).where(eq(settlements.groupId, group.id)),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const marketByTicker = new Map(marketRows.map((m) => [m.ticker, m]));
  const fillsByOffer = new Map<string, Fill[]>();
  for (const f of fillRows) {
    const list = fillsByOffer.get(f.offerId) ?? [];
    list.push(f);
    fillsByOffer.set(f.offerId, list);
  }

  const views = offerRows.map((o) => buildOfferView(o, memberById, marketByTicker, fillsByOffer));

  const open = views.filter((v) => v.offer.status === "open");
  const live = views.filter((v) => v.offer.status === "closed");
  const settled = views.filter((v) => v.offer.status === "settled");

  // Outstanding balances are derived, never stored: settled-fill winnings, then
  // netted down by any recorded real-world payments. Cancelled/voided offers are
  // excluded so their slices stop counting (computeBalances skips any fill whose
  // offer isn't in this list) — otherwise a voided offer's fills would silently
  // re-settle once its market resolved.
  const fillBalances = computeBalances(
    members.map((m) => m.id),
    offerRows
      .filter((o) => o.status !== "cancelled")
      .map((o) => ({
        id: o.id,
        makerId: o.makerId,
        side: o.side as Side,
        marketResult: (() => {
          const r = marketByTicker.get(o.marketTicker)?.result;
          return r === "yes" || r === "no" ? r : "";
        })(),
      })),
    fillRows.map((f) => ({
      offerId: f.offerId,
      takerId: f.takerId,
      stake: f.stake,
      yesPrice: f.lockedYesPrice,
    })),
  );
  const balances = applySettlements(fillBalances, settlementRows);

  const leaderboard: LeaderRow[] = members
    .map((member) => ({ member, balance: balances.get(member.id) ?? 0 }))
    .sort((a, b) => b.balance - a.balance || a.member.name.localeCompare(b.member.name));

  return {
    members,
    all: views,
    open,
    live,
    settled,
    leaderboard,
    transfers: settleUp(balances),
    hasSettled: settled.length > 0,
  };
}
