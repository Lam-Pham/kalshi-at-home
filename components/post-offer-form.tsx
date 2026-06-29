"use client";

import { useActionState, useState } from "react";
import { createOffer, type ActionState } from "@/app/actions/bets";
import { useLivePrice } from "@/components/use-live-price";
import { quoteOfferForMaker, type Side } from "@/lib/bets";
import { usd, cents } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initial: ActionState = {};

export function PostOfferForm({
  code,
  ticker,
  initialYesMid,
}: {
  code: string;
  ticker: string;
  initialYesMid: number;
}) {
  const [state, formAction, pending] = useActionState(
    createOffer.bind(null, code),
    initial,
  );
  const [side, setSide] = useState<Side>("yes");
  const [maxRisk, setMaxRisk] = useState("");

  const market = useLivePrice(ticker);
  const p = market?.yesMid ?? initialYesMid;
  const riskNum = Number(maxRisk);
  const valid = Number.isFinite(riskNum) && riskNum > 0;
  const quote = valid && p > 0 && p < 1 ? quoteOfferForMaker(side, p, riskNum) : null;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="ticker" value={ticker} />
      <input type="hidden" name="side" value={side} />

      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <span className="text-sm text-muted-foreground">Live yes price</span>
        <span className="font-mono text-lg font-semibold tabular-nums">{cents(p)}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your side
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(["yes", "no"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              className={cn(
                "h-10 rounded-lg border text-sm font-semibold uppercase tracking-wide transition-colors",
                side === s
                  ? s === "yes"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Max you&rsquo;ll risk
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <input
            name="maxRisk"
            inputMode="decimal"
            placeholder="20"
            value={maxRisk}
            onChange={(e) => setMaxRisk(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-background pl-6 pr-3 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </label>

      <p className="min-h-5 text-sm text-muted-foreground">
        {quote ? (
          <>
            Risk up to <span className="font-medium text-foreground">{usd(quote.makerRisk)}</span> to
            win up to <span className="font-medium text-emerald-600">{usd(quote.makerWin)}</span> if
            fully matched at {cents(p)}.
          </>
        ) : (
          <>Friends take the {side === "yes" ? "NO" : "YES"} side until your budget fills.</>
        )}
      </p>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" size="lg" disabled={pending || !valid}>
        {pending ? "Posting…" : "Post offer"}
      </Button>
    </form>
  );
}
