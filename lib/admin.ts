import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { groups, members, offers, fills, settlements, markets } from "@/db/schema";

// God-mode gate. Low-security by request — a shared 4-digit PIN, not real auth.
// It lives in one place so it's a one-line swap to a wrangler secret if this app
// ever holds anything worth protecting.
export const ADMIN_PIN = "2144";
const ADMIN_COOKIE = "kf_admin";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function isAdmin(): Promise<boolean> {
  return (await cookies()).get(ADMIN_COOKIE)?.value === "ok";
}

export async function setAdmin(on: boolean): Promise<void> {
  const jar = await cookies();
  if (on) {
    jar.set(ADMIN_COOKIE, "ok", { httpOnly: true, sameSite: "lax", path: "/", maxAge: THIRTY_DAYS });
  } else {
    jar.delete(ADMIN_COOKIE);
  }
}

/** Bounce non-admins to the gate. Call at the top of every admin action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin");
}

export interface AdminOfferRow {
  id: string;
  ticker: string;
  title: string;
  side: string;
  maxRisk: number;
  status: string;
  fillCount: number;
}
export interface AdminSettlementRow {
  id: string;
  from: string;
  to: string;
  amount: number;
}
export interface AdminMemberRow {
  id: string;
  name: string;
}
export interface AdminRoom {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
  members: AdminMemberRow[];
  offers: AdminOfferRow[];
  settlements: AdminSettlementRow[];
}

/** Everything, every room — assembled in memory (friends scale = tiny data). */
export async function getAdminOverview(): Promise<AdminRoom[]> {
  const db = getDb();
  const [groupRows, memberRows, offerRows, fillRows, settlementRows, marketRows] =
    await Promise.all([
      db.select().from(groups),
      db.select({ id: members.id, groupId: members.groupId, name: members.name }).from(members),
      db.select().from(offers),
      db.select({ id: fills.id, offerId: fills.offerId }).from(fills),
      db.select().from(settlements),
      db.select({ ticker: markets.ticker, title: markets.title }).from(markets),
    ]);

  const titleByTicker = new Map(marketRows.map((m) => [m.ticker, m.title]));
  const nameById = new Map(memberRows.map((m) => [m.id, m.name]));
  const fillsByOffer = new Map<string, number>();
  for (const f of fillRows) fillsByOffer.set(f.offerId, (fillsByOffer.get(f.offerId) ?? 0) + 1);

  return groupRows
    .map((g) => ({
      id: g.id,
      name: g.name,
      inviteCode: g.inviteCode,
      createdAt: g.createdAt,
      members: memberRows
        .filter((m) => m.groupId === g.id)
        .map((m) => ({ id: m.id, name: m.name })),
      offers: offerRows
        .filter((o) => o.groupId === g.id)
        .map((o) => ({
          id: o.id,
          ticker: o.marketTicker,
          title: titleByTicker.get(o.marketTicker) ?? o.marketTicker,
          side: o.side,
          maxRisk: o.maxRisk,
          status: o.status,
          fillCount: fillsByOffer.get(o.id) ?? 0,
        })),
      settlements: settlementRows
        .filter((s) => s.groupId === g.id)
        .map((s) => ({
          id: s.id,
          from: nameById.get(s.fromId) ?? "?",
          to: nameById.get(s.toId) ?? "?",
          amount: s.amount,
        })),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
