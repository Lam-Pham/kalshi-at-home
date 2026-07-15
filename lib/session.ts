import { cookies } from "next/headers";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { groups, markets, members, offers } from "@/db/schema";
import { memberCookieName, MEMBER_COOKIE_PREFIX } from "@/lib/ids";
import type { Group, Market, Offer, PublicMember } from "@/db/schema";

const ONE_YEAR = 60 * 60 * 24 * 365;

// Every read selects exactly the client-safe columns — the PIN hash stays on the
// server. Spreading `...rest` from a full row would re-leak it, so we list them.
const publicCols = {
  id: members.id,
  groupId: members.groupId,
  name: members.name,
  createdAt: members.createdAt,
} as const;

/** Bind this device to `memberId` for `groupId` (used on join, reclaim, relink). */
export async function setMemberCookie(groupId: string, memberId: string): Promise<void> {
  (await cookies()).set(memberCookieName(groupId), memberId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    priority: "high",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

/** Look up a room by its shareable invite code. */
export async function getRoomByCode(code: string): Promise<Group | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, code))
    .limit(1);
  return rows[0] ?? null;
}

/** The member this device is signed in as for `groupId`, or null if not joined. */
export async function getCurrentMember(groupId: string): Promise<PublicMember | null> {
  const memberId = (await cookies()).get(memberCookieName(groupId))?.value;
  if (!memberId) return null;
  const db = getDb();
  const rows = await db
    .select(publicCols)
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  const m = rows[0];
  // Guard against a stale cookie pointing at a member of another group.
  return m && m.groupId === groupId ? m : null;
}

/** All members of a room, oldest first. */
export async function getMembers(groupId: string): Promise<PublicMember[]> {
  const db = getDb();
  return db
    .select(publicCols)
    .from(members)
    .where(eq(members.groupId, groupId))
    .orderBy(members.createdAt);
}

/** Memberships on this device, derived from its per-group cookies. */
async function getMyMemberships(): Promise<Array<{ group: Group; me: PublicMember }>> {
  const jar = (await cookies()).getAll();
  const pairs = jar
    .filter((c) => c.name.startsWith(MEMBER_COOKIE_PREFIX))
    .map((c) => ({ groupId: c.name.slice(MEMBER_COOKIE_PREFIX.length), memberId: c.value }));
  if (pairs.length === 0) return [];

  const db = getDb();
  const groupIds = pairs.map((p) => p.groupId);
  const memberIds = pairs.map((p) => p.memberId);
  const [groupRows, memberRows] = await Promise.all([
    db.select().from(groups).where(inArray(groups.id, groupIds)),
    db.select(publicCols).from(members).where(inArray(members.id, memberIds)),
  ]);
  const groupById = new Map(groupRows.map((g) => [g.id, g]));
  const memberById = new Map(memberRows.map((m) => [m.id, m]));

  const result: Array<{ group: Group; me: PublicMember }> = [];
  for (const p of pairs) {
    const group = groupById.get(p.groupId);
    const me = memberById.get(p.memberId);
    // Only include valid, consistent memberships.
    if (group && me && me.groupId === group.id) result.push({ group, me });
  }
  return result;
}

/** Traditional multi-bet rooms this device has joined. */
export async function getMyRooms(): Promise<Array<{ group: Group; me: PublicMember }>> {
  return (await getMyMemberships()).filter(({ group }) => group.kind === "room");
}

export interface MyQuickBet {
  group: Group;
  me: PublicMember;
  offer: Offer & { shareCode: string };
  market: Market | null;
}

/** One-off bets this device can reopen from the homepage. */
export async function getMyQuickBets(): Promise<MyQuickBet[]> {
  const memberships = (await getMyMemberships()).filter(({ group }) => group.kind === "quick");
  if (memberships.length === 0) return [];

  const db = getDb();
  const groupIds = memberships.map(({ group }) => group.id);
  const offerRows = await db
    .select()
    .from(offers)
    .where(and(inArray(offers.groupId, groupIds), isNotNull(offers.shareCode)));
  const relevant = offerRows.filter((offer) => offer.shareCode);
  const tickers = [...new Set(relevant.map((offer) => offer.marketTicker))];
  const marketRows = tickers.length
    ? await db.select().from(markets).where(inArray(markets.ticker, tickers))
    : [];
  const membershipByGroup = new Map(memberships.map((item) => [item.group.id, item]));
  const marketByTicker = new Map(marketRows.map((market) => [market.ticker, market]));

  return relevant
    .flatMap((offer): MyQuickBet[] => {
      const membership = membershipByGroup.get(offer.groupId);
      if (!membership || !offer.shareCode) return [];
      return [
        {
          ...membership,
          offer: { ...offer, shareCode: offer.shareCode },
          market: marketByTicker.get(offer.marketTicker) ?? null,
        },
      ];
    })
    .sort((a, b) => b.offer.createdAt.getTime() - a.offer.createdAt.getTime());
}
