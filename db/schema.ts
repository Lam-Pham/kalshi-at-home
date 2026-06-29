import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

// ── groups ────────────────────────────────────────────────────────────────
// A private room of friends. `inviteCode` is the shareable join secret.
export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// ── members ───────────────────────────────────────────────────────────────
// Identity = display name + 4-digit PIN. The device cookie holds the member id;
// the PIN lets the same person reclaim that identity on a new device (and gates
// taking someone else's name). `pinHash` is a salted PBKDF2 digest (see
// lib/pin.ts) — it must NEVER reach the client (a 4-digit PIN is brute-forceable
// offline in 10k guesses), so reads go through the pinHash-less PublicMember.
// Names are unique per room.
export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
    name: text("name").notNull(),
    pinHash: text("pin_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("members_group_name_unq").on(t.groupId, t.name)],
);

// ── markets ───────────────────────────────────────────────────────────────
// Local cache of Kalshi market state. Prices are DOLLARS (0..1), matching
// Kalshi's `*_dollars` string fields parsed to floats. `result` is "" until
// the market settles, then "yes" / "no".
export const markets = sqliteTable("markets", {
  ticker: text("ticker").primaryKey(),
  eventTicker: text("event_ticker"),
  title: text("title").notNull(),
  // Outcome label (Kalshi `yes_sub_title`) — distinguishes the many markets of
  // a multi-outcome event, which all share one `title`.
  yesSubTitle: text("yes_sub_title").notNull().default(""),
  yesBid: real("yes_bid").notNull(),
  yesAsk: real("yes_ask").notNull(),
  status: text("status").notNull(),
  result: text("result").notNull().default(""),
  closeTs: integer("close_ts", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// ── offers ────────────────────────────────────────────────────────────────
// A maker's standing offer: a side + a max-risk budget (no price). Takers fill
// slices of the opposite side until the budget is exhausted.
export const offers = sqliteTable("offers", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id),
  marketTicker: text("market_ticker")
    .notNull()
    .references(() => markets.ticker),
  makerId: text("maker_id")
    .notNull()
    .references(() => members.id),
  side: text("side", { enum: ["yes", "no"] }).notNull(),
  maxRisk: real("max_risk").notNull(),
  status: text("status", { enum: ["open", "closed", "settled", "cancelled"] })
    .notNull()
    .default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// ── fills ─────────────────────────────────────────────────────────────────
// One taker's slice of an offer. `lockedYesPrice` is the live Kalshi yes
// mid-price (0..1) captured server-side at confirm time. `stake` is what the
// taker risks in dollars. Maker's matched risk is derived from true-odds math.
export const fills = sqliteTable("fills", {
  id: text("id").primaryKey(),
  offerId: text("offer_id")
    .notNull()
    .references(() => offers.id),
  takerId: text("taker_id")
    .notNull()
    .references(() => members.id),
  stake: real("stake").notNull(),
  lockedYesPrice: real("locked_yes_price").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// ── settlements ───────────────────────────────────────────────────────────
// A recorded real-world payment (e.g. a Venmo). `from` paid `to` `amount`, which
// nets down their outstanding balance so the ledger resets after people square
// up. Like balances, the running "who owes whom" is DERIVED: settled fills minus
// settlements (see lib/bets.ts `applySettlements`).
export const settlements = sqliteTable("settlements", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id),
  fromId: text("from_id")
    .notNull()
    .references(() => members.id),
  toId: text("to_id")
    .notNull()
    .references(() => members.id),
  amount: real("amount").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Inferred row types for use across the app.
export type Group = typeof groups.$inferSelect;
export type Member = typeof members.$inferSelect;
/** A member as exposed to the client — never carries the PIN hash. */
export type PublicMember = Omit<Member, "pinHash">;
export type Market = typeof markets.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Fill = typeof fills.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
