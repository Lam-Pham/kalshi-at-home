"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { members, settlements } from "@/db/schema";
import { newId } from "@/lib/ids";
import { getRoomByCode, getCurrentMember } from "@/lib/session";
import { roundCents } from "@/lib/bets";

export type ActionState = { error?: string };

/**
 * Record a real-world payment (the friends paid up on Venmo), which nets down
 * the outstanding ledger. Any room member may log a transfer between two members
 * of their room — it's a shared, trust-based IOU sheet. from/to are bound from
 * the server-rendered suggested transfer, then re-validated here.
 */
export async function recordSettlement(
  code: string,
  fromId: string,
  toId: string,
  amount: number,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const group = await getRoomByCode(code);
  if (!group) return { error: "That room doesn’t exist." };
  const me = await getCurrentMember(group.id);
  if (!me) return { error: "Join this room first." };

  if (fromId === toId) return { error: "A payment needs two different people." };
  if (!(amount > 0) || !Number.isFinite(amount)) return { error: "Enter a valid amount." };

  const db = getDb();
  const pair = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.groupId, group.id)));
  const ids = new Set(pair.map((m) => m.id));
  if (!ids.has(fromId) || !ids.has(toId)) {
    return { error: "Those players aren’t both in this room." };
  }

  await db.insert(settlements).values({
    id: newId(),
    groupId: group.id,
    fromId,
    toId,
    amount: roundCents(amount),
    createdAt: new Date(),
  });

  redirect(`/room/${code}`);
}
