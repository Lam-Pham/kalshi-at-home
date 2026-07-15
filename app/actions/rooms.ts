"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { groups, members } from "@/db/schema";
import { newId, newInviteCode } from "@/lib/ids";
import { setMemberCookie } from "@/lib/session";
import { hashPin, verifyPin } from "@/lib/pin";

const Name = z.string().trim().min(1).max(40);
const Pin = z.string().regex(/^\d{4}$/);

export type ActionState = { error?: string };

/** Create a new room; the creator becomes its first member. */
export async function createRoom(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const room = Name.safeParse(formData.get("roomName"));
  const you = Name.safeParse(formData.get("yourName"));
  const pin = Pin.safeParse(formData.get("pin"));
  if (!room.success) return { error: "Give your room a name." };
  if (!you.success) return { error: "Enter your name." };
  if (!pin.success) return { error: "Pick a 4-digit PIN — it's how you sign back in." };

  const db = getDb();
  const groupId = newId();
  const memberId = newId();
  const inviteCode = newInviteCode();
  const now = new Date();

  await db.insert(groups).values({
    id: groupId,
    name: room.data,
    kind: "room",
    inviteCode,
    createdAt: now,
  });
  await db.insert(members).values({
    id: memberId,
    groupId,
    name: you.data,
    pinHash: await hashPin(pin.data),
    createdAt: now,
  });

  await setMemberCookie(groupId, memberId);
  redirect(`/room/${inviteCode}`); // throws NEXT_REDIRECT — must stay outside try/catch
}

/**
 * Join a room, or reclaim an identity on a new device — one flow, keyed on name:
 *   • name is free → create a new member with this name + PIN.
 *   • name exists → it must be *you* coming back: the PIN has to match. Right PIN
 *     re-points this device at the existing member; wrong PIN is rejected, which
 *     is also what blocks two people sharing a display name.
 * `code` is bound by the caller.
 */
export async function joinRoom(
  code: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const you = Name.safeParse(formData.get("yourName"));
  const pin = Pin.safeParse(formData.get("pin"));
  if (!you.success) return { error: "Enter your name." };
  if (!pin.success) return { error: "Enter your 4-digit PIN." };

  const db = getDb();
  const found = await db
    .select()
    .from(groups)
    .where(eq(groups.inviteCode, code))
    .limit(1);
  const group = found[0];
  if (!group) return { error: "That room doesn’t exist." };

  const existing = await db
    .select()
    .from(members)
    .where(and(eq(members.groupId, group.id), eq(members.name, you.data)))
    .limit(1);

  let memberId: string;
  if (existing[0]) {
    // Returning player (or a name clash) — prove it's you with the PIN.
    if (!(await verifyPin(pin.data, existing[0].pinHash))) {
      return { error: "That name is taken. If it’s you, enter your PIN; otherwise pick another name." };
    }
    memberId = existing[0].id;
  } else {
    memberId = newId();
    try {
      await db.insert(members).values({
        id: memberId,
        groupId: group.id,
        name: you.data,
        pinHash: await hashPin(pin.data),
        createdAt: new Date(),
      });
    } catch {
      // Lost a race for the same new name (unique index) — treat as taken.
      return { error: "That name was just taken — try another." };
    }
  }

  await setMemberCookie(group.id, memberId);
  redirect(`/room/${code}`);
}
