import { cookies } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { groups, members } from "@/db/schema";
import { memberCookieName, MEMBER_COOKIE_PREFIX } from "@/lib/ids";
import type { Group, PublicMember } from "@/db/schema";

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

/** Rooms this device has joined (derived from its kf_m_* cookies). */
export async function getMyRooms(): Promise<Array<{ group: Group; me: PublicMember }>> {
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
