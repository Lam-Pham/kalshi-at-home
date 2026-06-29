"use server";

import { redirect } from "next/navigation";
import { eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { groups, members, offers, fills, settlements } from "@/db/schema";
import { newInviteCode } from "@/lib/ids";
import { hashPin } from "@/lib/pin";
import { setMemberCookie } from "@/lib/session";
import { ADMIN_PIN, requireAdmin, setAdmin } from "@/lib/admin";

export type ActionState = { error?: string };

const Pin = z.string().regex(/^\d{4}$/);
const Name = z.string().trim().min(1).max(40);

/** Enter the admin PIN (2144) to unlock god mode. */
export async function adminLogin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const pin = String(formData.get("pin") ?? "");
  if (pin !== ADMIN_PIN) return { error: "Wrong PIN." };
  await setAdmin(true);
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await requireAdmin();
  await setAdmin(false);
  redirect("/admin");
}

/** Rename a member (subject to the per-room unique-name rule). */
export async function adminRenameMember(memberId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const name = Name.safeParse(formData.get("name"));
  if (!name.success) redirect("/admin");

  const db = getDb();
  try {
    await db.update(members).set({ name: name.data }).where(eq(members.id, memberId));
  } catch {
    /* unique-name clash — leave unchanged */
  }
  redirect("/admin");
}

/** Reset a member's PIN — the recovery backstop when someone forgets theirs. */
export async function adminResetPin(memberId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const pin = Pin.safeParse(formData.get("pin"));
  if (!pin.success) redirect("/admin");
  const db = getDb();
  await db.update(members).set({ pinHash: await hashPin(pin.data) }).where(eq(members.id, memberId));
  redirect("/admin");
}

/**
 * Sign THIS device in as any member — the manual cross-device recovery path
 * ("re-link Alex to my phone"). Drops you straight into their room.
 */
export async function adminRelinkMember(memberId: string): Promise<void> {
  await requireAdmin();
  const db = getDb();
  const row = (
    await db.select().from(members).where(eq(members.id, memberId)).limit(1)
  )[0];
  if (!row) redirect("/admin");
  const group = (
    await db.select().from(groups).where(eq(groups.id, row.groupId)).limit(1)
  )[0];
  if (!group) redirect("/admin");
  await setMemberCookie(group.id, memberId);
  redirect(`/room/${group.inviteCode}`);
}

/** Delete a member, but only if they have no betting/payment history to orphan. */
export async function adminDeleteMember(memberId: string): Promise<void> {
  await requireAdmin();
  const db = getDb();
  const [madeOffer, tookFill, paid] = await Promise.all([
    db.select({ id: offers.id }).from(offers).where(eq(offers.makerId, memberId)).limit(1),
    db.select({ id: fills.id }).from(fills).where(eq(fills.takerId, memberId)).limit(1),
    db
      .select({ id: settlements.id })
      .from(settlements)
      .where(or(eq(settlements.fromId, memberId), eq(settlements.toId, memberId)))
      .limit(1),
  ]);
  if (madeOffer.length || tookFill.length || paid.length) redirect("/admin"); // has history — keep it
  await db.delete(members).where(eq(members.id, memberId));
  redirect("/admin");
}

/** Issue a fresh invite code, invalidating the old shared link. */
export async function adminRotateInvite(groupId: string): Promise<void> {
  await requireAdmin();
  const db = getDb();
  await db.update(groups).set({ inviteCode: newInviteCode() }).where(eq(groups.id, groupId));
  redirect("/admin");
}

/** Force a stuck/mistaken offer out of play (its slices stop mattering). */
export async function adminVoidOffer(offerId: string): Promise<void> {
  await requireAdmin();
  const db = getDb();
  await db.update(offers).set({ status: "cancelled" }).where(eq(offers.id, offerId));
  redirect("/admin");
}

/** Undo a wrongly-recorded payment. */
export async function adminDeleteSettlement(settlementId: string): Promise<void> {
  await requireAdmin();
  const db = getDb();
  await db.delete(settlements).where(eq(settlements.id, settlementId));
  redirect("/admin");
}

/** Nuke a whole room and everything under it. */
export async function adminDeleteRoom(groupId: string): Promise<void> {
  await requireAdmin();
  const db = getDb();
  const groupOffers = await db
    .select({ id: offers.id })
    .from(offers)
    .where(eq(offers.groupId, groupId));
  const offerIds = groupOffers.map((o) => o.id);
  if (offerIds.length) await db.delete(fills).where(inArray(fills.offerId, offerIds));
  await db.delete(offers).where(eq(offers.groupId, groupId));
  await db.delete(settlements).where(eq(settlements.groupId, groupId));
  await db.delete(members).where(eq(members.groupId, groupId));
  await db.delete(groups).where(eq(groups.id, groupId));
  redirect("/admin");
}
