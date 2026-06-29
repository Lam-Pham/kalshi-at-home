"use client";

import { useActionState, useState } from "react";
import { takeFill, type ActionState } from "@/app/actions/bets";
import { useLivePrice } from "@/components/use-live-price";
import {
  quoteSlice,
  maxStakeForBudget,
  oppositeSide,
  type Side,
} from "@/lib/bets";
import { usd, cents } from "@/lib/format";
import { Button } from "@/components/ui/button";

const initial: ActionState = {};

export function TakeSlice({
  code,
  offerId,
  ticker,
  makerSide,
  remaining,
  initialYesMid,
}: {
  code: string;
  offerId: string;
  ticker: string;
  makerSide: Side;
  remaining: number;
  initialYesMid?: number;
}) {
  const [state, formAction, pending] = useActionState(
    takeFill.bind(null, code, offerId),
    initial,
  );
  const [stake, setStake] = useState("");

  const market = useLivePrice(ticker);
  const p = market?.yesMid ?? initialYesMid ?? 0;
  const takerSide = oppositeSide(makerSide);
  const maxStake = p > 0 && p < 1 ? maxStakeForBudget(remaining, p, takerSide) : 0;

  const stakeNum = Number(stake);
  const valid = Number.isFinite(stakeNum) && stakeNum > 0;
  const quote = valid && p > 0 && p < 1 ? quoteSlice(makerSide, p, stakeNum) : null;
  const overBudget = quote ? quote.makerRisk > remaining + 0.01 : false;

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Take the <span className="font-medium uppercase text-foreground">{takerSide}</span> side
        </span>
        <span className="font-mono tabular-nums">live {cents(p)}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <input
            name="stake"
            inputMode="decimal"
            placeholder="0"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background pl-6 pr-3 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <Button type="submit" disabled={pending || !valid || overBudget}>
          {pending ? "Locking…" : "Take it"}
        </Button>
      </div>

      <p className="min-h-4 text-xs text-muted-foreground">
        {quote && !overBudget ? (
          <>
            Risk <span className="font-medium text-foreground">{usd(quote.takerRisk)}</span> to win{" "}
            <span className="font-medium text-emerald-600">{usd(quote.takerWin)}</span> @ {cents(p)}
          </>
        ) : (
          <>Up to {usd(maxStake)} left at this price.</>
        )}
      </p>

      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
