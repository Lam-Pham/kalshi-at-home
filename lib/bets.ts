// Pure domain core: true-odds pricing, per-fill settlement, derived balances,
// and minimal settle-up. NO imports, NO I/O — every function is a pure
// transform over plain values, so it's exhaustively unit-testable (bets.test.ts)
// and reusable on the server (actions) and client (live quotes) alike.
//
// Pricing model (per fill, at live yes-probability p in (0,1)):
//   A YES taker staking $S is matched by maker NO risk of S*(1-p)/p.
//   A NO  taker staking $S is matched by maker YES risk of S*p/(1-p).
// These are the fair (zero-EV) odds: the favorite risks more to win less.
// Whoever's side matches Kalshi's final `result` takes the pot; their net gain
// equals the loser's stake.

export type Side = "yes" | "no";

export function oppositeSide(side: Side): Side {
  return side === "yes" ? "no" : "yes";
}

/** Round to whole cents — money is dollars, so two decimals is the grid. */
export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** A price is usable for a bet only when it implies a real two-sided odds. */
export function isPriceBettable(yesPrice: number): boolean {
  return Number.isFinite(yesPrice) && yesPrice > 0 && yesPrice < 1;
}

/**
 * Maker risk matched against a taker's stake at live yes-price `p`.
 * `takerSide` is the side the *taker* holds (the opposite of the maker's).
 */
export function makerRiskForStake(
  takerStake: number,
  yesPrice: number,
  takerSide: Side,
): number {
  const p = yesPrice;
  return takerSide === "yes"
    ? (takerStake * (1 - p)) / p
    : (takerStake * p) / (1 - p);
}

/**
 * Inverse of {@link makerRiskForStake}: the largest taker stake whose matched
 * maker risk fits within `budget`. Used to cap a slice to the remaining budget.
 */
export function maxStakeForBudget(
  budget: number,
  yesPrice: number,
  takerSide: Side,
): number {
  const p = yesPrice;
  return takerSide === "yes"
    ? (budget * p) / (1 - p)
    : (budget * (1 - p)) / p;
}

/** Maker risk already consumed by a set of fills (each priced at its own time). */
export function spentBudget(
  makerSide: Side,
  fills: Array<{ stake: number; yesPrice: number }>,
): number {
  const takerSide = oppositeSide(makerSide);
  return fills.reduce(
    (sum, f) => sum + makerRiskForStake(f.stake, f.yesPrice, takerSide),
    0,
  );
}

/** Maker risk still available on an offer (never negative). */
export function remainingBudget(
  maxRisk: number,
  makerSide: Side,
  fills: Array<{ stake: number; yesPrice: number }>,
): number {
  return Math.max(0, maxRisk - spentBudget(makerSide, fills));
}

/** What a single slice looks like to the taker, given the maker's side. */
export interface SliceQuote {
  takerSide: Side;
  /** What the taker puts at risk (their stake). */
  takerRisk: number;
  /** What the taker wins on top of their stake (== matched maker risk). */
  takerWin: number;
  /** Raw (unrounded) maker risk this slice consumes from the offer budget. */
  makerRisk: number;
}

export function quoteSlice(
  makerSide: Side,
  yesPrice: number,
  takerStake: number,
): SliceQuote {
  const takerSide = oppositeSide(makerSide);
  const makerRisk = makerRiskForStake(takerStake, yesPrice, takerSide);
  return {
    takerSide,
    takerRisk: roundCents(takerStake),
    takerWin: roundCents(makerRisk),
    makerRisk,
  };
}

/** What an offer looks like to the maker if its whole budget fills at `p`. */
export function quoteOfferForMaker(
  makerSide: Side,
  yesPrice: number,
  maxRisk: number,
): { makerRisk: number; makerWin: number } {
  const takerSide = oppositeSide(makerSide);
  return {
    makerRisk: roundCents(maxRisk),
    makerWin: roundCents(maxStakeForBudget(maxRisk, yesPrice, takerSide)),
  };
}

/** Net dollar change to maker and taker once a fill's market settles. */
export function settleFill(args: {
  stake: number;
  yesPrice: number;
  makerSide: Side;
  result: Side;
}): { makerDelta: number; takerDelta: number } {
  const takerSide = oppositeSide(args.makerSide);
  const makerRisk = makerRiskForStake(args.stake, args.yesPrice, takerSide);
  if (args.result === takerSide) {
    // Taker's side won — they take the maker's matched risk.
    return { takerDelta: makerRisk, makerDelta: -makerRisk };
  }
  // Maker's side won — they take the taker's stake.
  return { makerDelta: args.stake, takerDelta: -args.stake };
}

// ── Aggregation over a whole room (plain shapes; no DB types) ───────────────

export interface BalanceOffer {
  id: string;
  makerId: string;
  side: Side;
  /** "" until the offer's market settles, then Kalshi's result. */
  marketResult: Side | "";
}

export interface BalanceFill {
  offerId: string;
  takerId: string;
  stake: number;
  yesPrice: number;
}

/**
 * Net balance per member, derived purely from *settled* fills. Members with no
 * settled action are present with 0. The sum across members is always ~0
 * (it's a closed IOU ledger).
 */
export function computeBalances(
  memberIds: string[],
  offers: BalanceOffer[],
  fills: BalanceFill[],
): Map<string, number> {
  const bal = new Map<string, number>();
  for (const id of memberIds) bal.set(id, 0);

  const offerById = new Map(offers.map((o) => [o.id, o]));
  for (const f of fills) {
    const offer = offerById.get(f.offerId);
    if (!offer) continue;
    if (offer.marketResult !== "yes" && offer.marketResult !== "no") continue;

    const { makerDelta, takerDelta } = settleFill({
      stake: f.stake,
      yesPrice: f.yesPrice,
      makerSide: offer.side,
      result: offer.marketResult,
    });
    bal.set(offer.makerId, (bal.get(offer.makerId) ?? 0) + makerDelta);
    bal.set(f.takerId, (bal.get(f.takerId) ?? 0) + takerDelta);
  }

  for (const [id, v] of bal) bal.set(id, roundCents(v));
  return bal;
}

export interface SettlementRec {
  fromId: string;
  toId: string;
  amount: number;
}

/**
 * Fold recorded real-world payments into derived balances. A payment from a
 * debtor to a creditor moves both toward zero — the payer's balance rises, the
 * payee's falls — so once friends square up via Venmo the ledger resets. Stays a
 * closed system: every settlement adds `amount` to one side and subtracts it
 * from the other, so the balances keep summing to ~0.
 */
export function applySettlements(
  balances: Map<string, number>,
  settlements: SettlementRec[],
): Map<string, number> {
  const out = new Map(balances);
  for (const s of settlements) {
    out.set(s.fromId, roundCents((out.get(s.fromId) ?? 0) + s.amount));
    out.set(s.toId, roundCents((out.get(s.toId) ?? 0) - s.amount));
  }
  return out;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

/**
 * Minimal-ish set of payments that zero out the balances: greedily match the
 * biggest debtor to the biggest creditor. Not provably optimal (that's
 * NP-hard), but at friends scale it produces clean, intuitive transfers.
 */
export function settleUp(balances: Map<string, number>): Transfer[] {
  const EPS = 0.005;
  const creditors: Array<{ id: string; amt: number }> = [];
  const debtors: Array<{ id: string; amt: number }> = [];
  for (const [id, v] of balances) {
    const c = roundCents(v);
    if (c > EPS) creditors.push({ id, amt: c });
    else if (c < -EPS) debtors.push({ id, amt: -c });
  }
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = roundCents(Math.min(debtors[i].amt, creditors[j].amt));
    if (pay > 0) {
      transfers.push({ fromId: debtors[i].id, toId: creditors[j].id, amount: pay });
    }
    debtors[i].amt = roundCents(debtors[i].amt - pay);
    creditors[j].amt = roundCents(creditors[j].amt - pay);
    if (debtors[i].amt <= EPS) i++;
    if (creditors[j].amt <= EPS) j++;
  }
  return transfers;
}
