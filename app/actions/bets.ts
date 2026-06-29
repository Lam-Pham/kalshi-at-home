"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { offers, fills } from "@/db/schema";
import { newId } from "@/lib/ids";
import { getRoomByCode, getCurrentMember } from "@/lib/session";
import { fetchMarket, isBettable } from "@/lib/kalshi";
import { cacheMarket } from "@/lib/markets";
import {
  oppositeSide,
  makerRiskForStake,
  remainingBudget,
  maxStakeForBudget,
  roundCents,
  type Side,
} from "@/lib/bets";

export type ActionState = { error?: string };

const Side = z.enum(["yes", "no"]);
const Ticker = z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/);
const Risk = z.coerce.number().positive().max(100_000);
const Stake = z.coerce.number().positive().max(100_000);
const BUDGET_EPS = 0.01; // a penny of slack absorbs float dust.

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Resolve the acting member for a room, or null if this device hasn't joined. */
async function actor(code: string) {
  const group = await getRoomByCode(code);
  if (!group) return null;
  const me = await getCurrentMember(group.id);
  return me ? { group, me } : null;
}

/**
 * Post a standing offer: a side + a max-risk budget on a live Kalshi market.
 * The market is re-fetched server-side and must be bettable right now.
 */
export async function createOffer(
  code: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const who = await actor(code);
  if (!who) return { error: "Join this room before posting a bet." };

  const side = Side.safeParse(formData.get("side"));
  const ticker = Ticker.safeParse(formData.get("ticker"));
  const maxRisk = Risk.safeParse(formData.get("maxRisk"));
  if (!ticker.success) return { error: "Pick a market first." };
  if (!side.success) return { error: "Choose YES or NO." };
  if (!maxRisk.success) return { error: "Enter how much you'll risk (a dollar amount)." };

  let market;
  try {
    market = await fetchMarket(ticker.data);
  } catch {
    return { error: "Couldn't reach Kalshi for that market — try again." };
  }
  if (!isBettable(market)) {
    return { error: "That market isn't bettable right now (closed or one-sided)." };
  }
  await cacheMarket(market);

  const db = getDb();
  await db.insert(offers).values({
    id: newId(),
    groupId: who.group.id,
    marketTicker: market.ticker,
    makerId: who.me.id,
    side: side.data,
    maxRisk: roundCents(maxRisk.data),
    status: "open",
    createdAt: new Date(),
  });

  redirect(`/room/${code}`);
}

/**
 * Take a slice of an open offer. INTEGRITY RULE: we re-fetch the live price
 * here and price the slice off it — never the client's possibly-stale display.
 */
export async function takeFill(
  code: string,
  offerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const who = await actor(code);
  if (!who) return { error: "Join this room before taking a bet." };

  const stake = Stake.safeParse(formData.get("stake"));
  if (!stake.success) return { error: "Enter what you'll risk (a dollar amount)." };

  const db = getDb();
  const offerRows = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  const offer = offerRows[0];
  if (!offer || offer.groupId !== who.group.id) return { error: "That bet doesn't exist." };
  if (offer.status !== "open") return { error: "This bet is no longer open." };
  if (offer.makerId === who.me.id) return { error: "You can't take your own bet." };

  let market;
  try {
    market = await fetchMarket(offer.marketTicker);
  } catch {
    return { error: "Couldn't reach Kalshi to lock a price — try again." };
  }
  if (!isBettable(market)) {
    return { error: "This market just stopped being bettable — no price to lock." };
  }
  await cacheMarket(market);

  const p = market.yesMid;
  const makerSide = offer.side as Side;
  const takerSide = oppositeSide(makerSide);

  const existing = await db
    .select({ stake: fills.stake, yesPrice: fills.lockedYesPrice })
    .from(fills)
    .where(eq(fills.offerId, offer.id));
  const remaining = remainingBudget(offer.maxRisk, makerSide, existing);

  const myMakerRisk = makerRiskForStake(stake.data, p, takerSide);
  if (myMakerRisk > remaining + BUDGET_EPS) {
    const maxStake = roundCents(maxStakeForBudget(remaining, p, takerSide));
    return {
      error:
        maxStake > 0
          ? `Only ${money(remaining)} of this bet is left — your max stake is ${money(maxStake)}.`
          : "This bet is fully matched.",
    };
  }

  await db.insert(fills).values({
    id: newId(),
    offerId: offer.id,
    takerId: who.me.id,
    stake: roundCents(stake.data),
    lockedYesPrice: p,
    createdAt: new Date(),
  });

  // Budget exhausted → stop taking new slices (existing ones ride to settlement).
  if (remaining - myMakerRisk <= BUDGET_EPS) {
    await db.update(offers).set({ status: "closed" }).where(eq(offers.id, offer.id));
  }

  redirect(`/room/${code}`);
}

/**
 * Maker withdraws an open offer. With no fills it's cancelled outright; with
 * fills it just closes to new takers (those slices stay live to settlement).
 */
export async function closeOffer(
  code: string,
  offerId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const who = await actor(code);
  if (!who) return { error: "Join this room first." };

  const db = getDb();
  const offerRows = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  const offer = offerRows[0];
  if (!offer || offer.groupId !== who.group.id) return { error: "That bet doesn't exist." };
  if (offer.makerId !== who.me.id) return { error: "Only the maker can close this bet." };
  if (offer.status !== "open") return { error: "This bet is already closed." };

  const taken = await db.select({ id: fills.id }).from(fills).where(eq(fills.offerId, offer.id)).limit(1);
  const status = taken.length > 0 ? "closed" : "cancelled";
  await db.update(offers).set({ status }).where(eq(offers.id, offer.id));

  redirect(`/room/${code}`);
}
