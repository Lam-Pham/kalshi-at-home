import { describe, it, expect } from "vitest";
import {
  oppositeSide,
  roundCents,
  isPriceBettable,
  makerRiskForStake,
  maxStakeForBudget,
  quoteSlice,
  quoteOfferForMaker,
  spentBudget,
  remainingBudget,
  settleFill,
  computeBalances,
  applySettlements,
  settleUp,
  type BalanceOffer,
  type BalanceFill,
} from "./bets";

describe("primitives", () => {
  it("oppositeSide flips", () => {
    expect(oppositeSide("yes")).toBe("no");
    expect(oppositeSide("no")).toBe("yes");
  });

  it("roundCents snaps to two decimals", () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(12.3456)).toBe(12.35);
    expect(roundCents(-0.001)).toBe(-0);
  });

  it("isPriceBettable rejects degenerate prices", () => {
    expect(isPriceBettable(0.5)).toBe(true);
    expect(isPriceBettable(0)).toBe(false);
    expect(isPriceBettable(1)).toBe(false);
    expect(isPriceBettable(NaN)).toBe(false);
  });
});

describe("true-odds pricing", () => {
  it("at p=0.5 both sides match dollar-for-dollar", () => {
    expect(makerRiskForStake(10, 0.5, "yes")).toBeCloseTo(10);
    expect(makerRiskForStake(10, 0.5, "no")).toBeCloseTo(10);
  });

  it("underdog (YES at p=0.25) risks less to win more", () => {
    // YES taker staking 25 is matched by 75 of maker NO risk.
    expect(makerRiskForStake(25, 0.25, "yes")).toBeCloseTo(75);
    // NO taker (the favorite) staking 75 is matched by only 25.
    expect(makerRiskForStake(75, 0.25, "no")).toBeCloseTo(25);
  });

  it("maxStakeForBudget is the exact inverse of makerRiskForStake", () => {
    for (const p of [0.1, 0.37, 0.5, 0.82, 0.99]) {
      for (const side of ["yes", "no"] as const) {
        const stake = maxStakeForBudget(60, p, side);
        expect(makerRiskForStake(stake, p, side)).toBeCloseTo(60);
      }
    }
  });
});

describe("quotes", () => {
  it("quoteSlice tells the taker what they risk and win", () => {
    // Maker is YES at p=0.25 → taker is NO, the favorite.
    const q = quoteSlice("yes", 0.25, 75);
    expect(q.takerSide).toBe("no");
    expect(q.takerRisk).toBe(75);
    expect(q.takerWin).toBe(25);
  });

  it("quoteOfferForMaker shows budget vs full-fill winnings", () => {
    // Maker NO at p=0.25, budget 75. If a single YES taker fills it all,
    // they'd stake 25, which the maker wins.
    const q = quoteOfferForMaker("no", 0.25, 75);
    expect(q.makerRisk).toBe(75);
    expect(q.makerWin).toBe(25);
  });
});

describe("budget", () => {
  it("spent + remaining accounts for every fill at its own locked price", () => {
    // Maker NO, budget 100. Two YES takers at different prices.
    const fills = [
      { stake: 25, yesPrice: 0.25 }, // consumes 75 of maker risk
      { stake: 5, yesPrice: 0.5 }, //  consumes 5
    ];
    expect(spentBudget("no", fills)).toBeCloseTo(80);
    expect(remainingBudget(100, "no", fills)).toBeCloseTo(20);
  });

  it("remaining never goes negative", () => {
    expect(remainingBudget(10, "yes", [{ stake: 100, yesPrice: 0.5 }])).toBe(0);
  });
});

describe("settlement", () => {
  it("pays the winning side the loser's stake", () => {
    // Maker NO, taker YES staking 25, matched maker risk 75.
    const yesWins = settleFill({ stake: 25, yesPrice: 0.25, makerSide: "no", result: "yes" });
    expect(yesWins.takerDelta).toBeCloseTo(75);
    expect(yesWins.makerDelta).toBeCloseTo(-75);

    const noWins = settleFill({ stake: 25, yesPrice: 0.25, makerSide: "no", result: "no" });
    expect(noWins.makerDelta).toBeCloseTo(25);
    expect(noWins.takerDelta).toBeCloseTo(-25);
  });

  it("every fill is zero-sum between maker and taker", () => {
    const r = settleFill({ stake: 40, yesPrice: 0.6, makerSide: "yes", result: "no" });
    expect(r.makerDelta + r.takerDelta).toBeCloseTo(0);
  });
});

describe("computeBalances", () => {
  const members = ["alex", "bri", "cy"];
  const offers: BalanceOffer[] = [
    { id: "o1", makerId: "alex", side: "no", marketResult: "yes" }, // settled
    { id: "o2", makerId: "alex", side: "yes", marketResult: "" }, // unsettled
  ];
  const fills: BalanceFill[] = [
    { offerId: "o1", takerId: "bri", stake: 25, yesPrice: 0.25 }, // bri YES wins 75
    { offerId: "o2", takerId: "cy", stake: 10, yesPrice: 0.5 }, // not settled → ignored
  ];

  it("only counts settled fills and zeroes everyone else", () => {
    const bal = computeBalances(members, offers, fills);
    expect(bal.get("bri")).toBeCloseTo(75);
    expect(bal.get("alex")).toBeCloseTo(-75);
    expect(bal.get("cy")).toBe(0); // their fill's market hasn't resolved
  });

  it("balances always sum to zero", () => {
    const bal = computeBalances(members, offers, fills);
    const total = [...bal.values()].reduce((s, v) => s + v, 0);
    expect(roundCents(total)).toBe(0);
  });
});

describe("applySettlements", () => {
  it("a payment nets the payer up and the payee down by the amount", () => {
    const balances = new Map([["alex", -75], ["bri", 75]]);
    const out = applySettlements(balances, [{ fromId: "alex", toId: "bri", amount: 75 }]);
    expect(out.get("alex")).toBe(0);
    expect(out.get("bri")).toBe(0);
  });

  it("a partial payment leaves the rest outstanding and conserves money", () => {
    const balances = new Map([["alex", -75], ["bri", 75]]);
    const out = applySettlements(balances, [{ fromId: "alex", toId: "bri", amount: 30 }]);
    expect(out.get("alex")).toBe(-45);
    expect(out.get("bri")).toBe(45);
    expect(roundCents([...out.values()].reduce((s, v) => s + v, 0))).toBe(0);
  });

  it("does not mutate the input map", () => {
    const balances = new Map([["alex", -10], ["bri", 10]]);
    applySettlements(balances, [{ fromId: "alex", toId: "bri", amount: 10 }]);
    expect(balances.get("alex")).toBe(-10);
  });

  it("settling fully clears the suggested transfers", () => {
    const balances = new Map([["alex", -75], ["bri", 50], ["cy", 25]]);
    const settled = applySettlements(balances, [
      { fromId: "alex", toId: "bri", amount: 50 },
      { fromId: "alex", toId: "cy", amount: 25 },
    ]);
    expect(settleUp(settled)).toEqual([]);
  });
});

describe("settleUp", () => {
  it("nets debtors against creditors and conserves money", () => {
    const balances = new Map([
      ["alex", -75],
      ["bri", 50],
      ["cy", 25],
    ]);
    const transfers = settleUp(balances);
    // alex owes 75, split to the two creditors.
    expect(transfers.every((t) => t.fromId === "alex")).toBe(true);
    const total = transfers.reduce((s, t) => s + t.amount, 0);
    expect(roundCents(total)).toBe(75);
  });

  it("returns nothing when everyone is square", () => {
    expect(settleUp(new Map([["a", 0], ["b", 0]]))).toEqual([]);
  });
});
