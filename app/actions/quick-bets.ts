"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { groups, members, offers, fills } from "@/db/schema";
import { getDb } from "@/lib/db";
import { newBetCode, newId, newInviteCode } from "@/lib/ids";
import { fetchMarket, isBettable } from "@/lib/kalshi";
import { cacheMarket } from "@/lib/markets";
import { hashPin, verifyPin } from "@/lib/pin";
import { getCurrentMember, setMemberCookie } from "@/lib/session";
import { getSharedBet } from "@/lib/shared-bets";
import {
  makerRiskForStake,
  maxStakeForBudget,
  oppositeSide,
  remainingBudget,
  roundCents,
  type Side,
} from "@/lib/bets";

export type QuickBetActionState = { error?: string };

const Name = z.string().trim().min(1).max(40);
const Pin = z.string().regex(/^\d{4}$/);
const SideSchema = z.enum(["yes", "no"]);
const Ticker = z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/);
const Money = z.coerce.number().min(0.01).max(100_000);
const ShareCode = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{10,20}$/);
const BUDGET_EPS = 0.01;

const money = (amount: number) =>
  amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Create a private one-off room, its maker identity, and its first bet. */
export async function createQuickBet(
  _previous: QuickBetActionState,
  formData: FormData,
): Promise<QuickBetActionState> {
  const name = Name.safeParse(formData.get("name"));
  const pin = Pin.safeParse(formData.get("pin"));
  const ticker = Ticker.safeParse(formData.get("ticker"));
  const side = SideSchema.safeParse(formData.get("side"));
  const maxRisk = Money.safeParse(formData.get("maxRisk"));

  if (!ticker.success) return { error: "Pick a live market first." };
  if (!side.success) return { error: "Choose YES or NO." };
  if (!maxRisk.success) return { error: "Enter the most you’re willing to lose." };
  if (!name.success) return { error: "Enter the name your friend knows you by." };
  if (!pin.success) return { error: "Choose a 4-digit PIN so you can reopen this bet." };

  let market;
  try {
    market = await fetchMarket(ticker.data);
  } catch {
    return { error: "Couldn’t reach Kalshi for a fresh price. Try again." };
  }
  if (!isBettable(market)) {
    return { error: "That market just stopped taking bets. Pick another one." };
  }
  await cacheMarket(market);

  const groupId = newId();
  const memberId = newId();
  const offerId = newId();
  const shareCode = newBetCode();
  const now = new Date();
  const pinHash = await hashPin(pin.data);
  const db = getDb();

  try {
    await db.batch([
      db.insert(groups).values({
        id: groupId,
        name: `${name.data}’s bet`,
        kind: "quick",
        inviteCode: newInviteCode(),
        createdAt: now,
      }),
      db.insert(members).values({
        id: memberId,
        groupId,
        name: name.data,
        pinHash,
        createdAt: now,
      }),
      db.insert(offers).values({
        id: offerId,
        shareCode,
        groupId,
        marketTicker: market.ticker,
        makerId: memberId,
        side: side.data,
        maxRisk: roundCents(maxRisk.data),
        status: "open",
        createdAt: now,
      }),
    ]);
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "quick bet creation failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return { error: "We couldn’t save that bet. Nothing was posted—please try again." };
  }

  await setMemberCookie(groupId, memberId);
  redirect(`/bet/${shareCode}?created=1`);
}

/** Join/reclaim an identity if needed, then take a live-priced slice. */
export async function takeSharedBet(
  rawShareCode: string,
  _previous: QuickBetActionState,
  formData: FormData,
): Promise<QuickBetActionState> {
  const parsedCode = ShareCode.safeParse(rawShareCode);
  const stake = Money.safeParse(formData.get("stake"));
  if (!parsedCode.success) return { error: "That bet link isn’t valid." };
  if (!stake.success) return { error: "Enter how much you’re willing to lose." };

  const shared = await getSharedBet(parsedCode.data);
  if (!shared) return { error: "That bet no longer exists." };
  if (shared.offer.status !== "open") return { error: "This bet is no longer open." };

  const db = getDb();
  let member = await getCurrentMember(shared.group.id);
  const needsMemberCookie = !member;
  let memberToCreate: { id: string; name: string; pinHash: string } | null = null;

  if (!member) {
    const name = Name.safeParse(formData.get("name"));
    const pin = Pin.safeParse(formData.get("pin"));
    if (!name.success) return { error: "Enter the name your friend knows you by." };
    if (!pin.success) return { error: "Choose a 4-digit PIN so you can reopen this bet." };

    const existingRows = await db
      .select()
      .from(members)
      .where(and(eq(members.groupId, shared.group.id), eq(members.name, name.data)))
      .limit(1);
    const existing = existingRows[0];
    if (existing) {
      if (!(await verifyPin(pin.data, existing.pinHash))) {
        return { error: "That name is taken. Use its PIN or choose another name." };
      }
      member = {
        id: existing.id,
        groupId: existing.groupId,
        name: existing.name,
        createdAt: existing.createdAt,
      };
    } else {
      memberToCreate = {
        id: newId(),
        name: name.data,
        pinHash: await hashPin(pin.data),
      };
    }
  }

  const memberId = member?.id ?? memberToCreate?.id;
  if (!memberId) return { error: "We couldn’t identify you for this bet." };
  if (memberId === shared.offer.makerId) return { error: "You can’t take your own side." };

  let market;
  try {
    market = await fetchMarket(shared.offer.marketTicker);
  } catch {
    return { error: "Couldn’t reach Kalshi to lock the odds. Try again." };
  }
  if (!isBettable(market)) {
    return { error: "This market just closed, so no new stake was added." };
  }
  await cacheMarket(market);

  const latestRows = await db
    .select()
    .from(offers)
    .where(eq(offers.id, shared.offer.id))
    .limit(1);
  const latest = latestRows[0];
  if (!latest || latest.status !== "open") return { error: "This bet was just closed." };

  const existingFills = await db
    .select({ stake: fills.stake, yesPrice: fills.lockedYesPrice })
    .from(fills)
    .where(eq(fills.offerId, latest.id));
  const makerSide = latest.side as Side;
  const takerSide = oppositeSide(makerSide);
  const remaining = remainingBudget(latest.maxRisk, makerSide, existingFills);
  const roundedStake = roundCents(stake.data);
  const matchedMakerRisk = makerRiskForStake(roundedStake, market.yesMid, takerSide);
  if (matchedMakerRisk > remaining + BUDGET_EPS) {
    const maximum = roundCents(maxStakeForBudget(remaining, market.yesMid, takerSide));
    return {
      error:
        maximum > 0
          ? `Only ${money(remaining)} is left—your maximum stake is ${money(maximum)}.`
          : "This bet was just fully matched.",
    };
  }

  const now = new Date();
  const insertFill = db.insert(fills).values({
    id: newId(),
    offerId: latest.id,
    takerId: memberId,
    stake: roundedStake,
    lockedYesPrice: market.yesMid,
    createdAt: now,
  });
  const shouldClose = remaining - matchedMakerRisk <= BUDGET_EPS;

  try {
    if (memberToCreate && shouldClose) {
      await db.batch([
        db.insert(members).values({
          id: memberToCreate.id,
          groupId: shared.group.id,
          name: memberToCreate.name,
          pinHash: memberToCreate.pinHash,
          createdAt: now,
        }),
        insertFill,
        db.update(offers).set({ status: "closed" }).where(eq(offers.id, latest.id)),
      ]);
    } else if (memberToCreate) {
      await db.batch([
        db.insert(members).values({
          id: memberToCreate.id,
          groupId: shared.group.id,
          name: memberToCreate.name,
          pinHash: memberToCreate.pinHash,
          createdAt: now,
        }),
        insertFill,
      ]);
    } else if (shouldClose) {
      await db.batch([
        insertFill,
        db.update(offers).set({ status: "closed" }).where(eq(offers.id, latest.id)),
      ]);
    } else {
      await insertFill;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "shared bet take failed",
        offerId: shared.offer.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return { error: "We couldn’t lock that stake. Nothing was added—please try again." };
  }

  if (needsMemberCookie) await setMemberCookie(shared.group.id, memberId);
  redirect(`/bet/${parsedCode.data}?joined=1`);
}

/** Let the maker stop accepting stakes while preserving any live fills. */
export async function closeSharedBet(
  rawShareCode: string,
  _previous: QuickBetActionState,
  _formData: FormData,
): Promise<QuickBetActionState> {
  void _previous;
  void _formData;
  const parsedCode = ShareCode.safeParse(rawShareCode);
  if (!parsedCode.success) return { error: "That bet link isn’t valid." };
  const shared = await getSharedBet(parsedCode.data);
  if (!shared) return { error: "That bet no longer exists." };
  const member = await getCurrentMember(shared.group.id);
  if (!member || member.id !== shared.offer.makerId) {
    return { error: "Only the person who created this bet can close it." };
  }
  if (shared.offer.status !== "open") return { error: "This bet is already closed." };

  const db = getDb();
  const taken = await db
    .select({ id: fills.id })
    .from(fills)
    .where(eq(fills.offerId, shared.offer.id))
    .limit(1);
  await db
    .update(offers)
    .set({ status: taken.length > 0 ? "closed" : "cancelled" })
    .where(eq(offers.id, shared.offer.id));
  redirect(`/bet/${parsedCode.data}`);
}
