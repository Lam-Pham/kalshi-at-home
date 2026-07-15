import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { groups, offers } from "@/db/schema";
import type { Group, Offer } from "@/db/schema";

export interface SharedBetRecord {
  group: Group;
  offer: Offer;
}

/** Find the room + offer behind an opaque public bet link. */
export async function getSharedBet(shareCode: string): Promise<SharedBetRecord | null> {
  const db = getDb();
  const normalized = shareCode.trim().toUpperCase();
  if (!/^[A-Z2-9]{10,20}$/.test(normalized)) return null;

  const offerRows = await db
    .select()
    .from(offers)
    .where(eq(offers.shareCode, normalized))
    .limit(1);
  const offer = offerRows[0];
  if (!offer) return null;

  const groupRows = await db
    .select()
    .from(groups)
    .where(eq(groups.id, offer.groupId))
    .limit(1);
  const group = groupRows[0];
  return group ? { group, offer } : null;
}
