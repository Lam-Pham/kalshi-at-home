"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { createQuickBet, type QuickBetActionState } from "@/app/actions/quick-bets";
import { useLivePrice } from "@/components/use-live-price";
import { quoteOfferForMaker, type Side } from "@/lib/bets";
import { cents, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const initialState: QuickBetActionState = {};
const presets = [5, 10, 20, 50];

export function QuickBetForm({
  ticker,
  title,
  outcome,
  initialYesMid,
}: {
  ticker: string;
  title: string;
  outcome: string;
  initialYesMid: number;
}) {
  const [state, action, pending] = useActionState(createQuickBet, initialState);
  const [side, setSide] = useState<Side>("yes");
  const [risk, setRisk] = useState("10");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const market = useLivePrice(ticker);
  const yesPrice = market?.yesMid ?? initialYesMid;
  const riskNumber = Number(risk);
  const validRisk = Number.isFinite(riskNumber) && riskNumber >= 0.01;
  const valid = validRisk && name.trim().length > 0 && /^\d{4}$/.test(pin);
  const quote = validRisk
    ? quoteOfferForMaker(side, yesPrice, riskNumber)
    : null;

  return (
    <form action={action} className="flex flex-col gap-7">
      <input type="hidden" name="ticker" value={ticker} />
      <input type="hidden" name="side" value={side} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Which side are you taking?</h2>
          <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs tabular-nums text-muted-foreground">
            YES {cents(yesPrice)} live
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2" data-testid="side-picker">
          {(["yes", "no"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setSide(choice)}
              aria-pressed={side === choice}
              className={cn(
                "relative flex min-h-24 flex-col items-start justify-between rounded-xl border p-4 text-left transition",
                side === choice
                  ? choice === "yes"
                    ? "border-emerald-500 bg-emerald-500/8 text-emerald-950 ring-2 ring-emerald-500/15 dark:text-emerald-100"
                    : "border-rose-500 bg-rose-500/8 text-rose-950 ring-2 ring-rose-500/15 dark:text-rose-100"
                  : "border-border bg-card hover:border-foreground/25 hover:bg-muted/50",
              )}
            >
              <span className="text-xs text-muted-foreground">I think the answer is</span>
              <span className="text-xl font-bold tracking-tight">{choice.toUpperCase()}</span>
              {side === choice ? (
                <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-foreground text-background">
                  <Check aria-hidden="true" className="size-3" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <label htmlFor="max-risk" className="text-sm font-semibold">
            What’s the most you could lose?
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your friend chooses their stake. You’re never on the hook for more than this.
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setRisk(String(preset))}
              className={cn(
                "h-9 min-w-14 rounded-lg border px-3 text-sm font-medium tabular-nums transition",
                Number(risk) === preset
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              ${preset}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
            $
          </span>
          <input
            id="max-risk"
            name="maxRisk"
            data-testid="max-risk"
            inputMode="decimal"
            value={risk}
            onChange={(event) => setRisk(event.target.value)}
            aria-invalid={!validRisk}
            className="h-14 w-full rounded-xl border border-border bg-card pl-8 pr-4 font-mono text-xl font-semibold tabular-nums outline-none transition focus:border-foreground/30 focus:ring-4 focus:ring-foreground/5"
          />
        </div>
        <div className="rounded-xl bg-muted/65 p-4 text-sm leading-relaxed">
          {quote ? (
            <>
              You risk up to <strong>{usd(quote.makerRisk)}</strong> on {side.toUpperCase()} to win
              up to <strong className="text-emerald-700 dark:text-emerald-400"> {usd(quote.makerWin)}</strong> if
              a friend fully matches it at today’s odds.
            </>
          ) : (
            <>Enter a dollar amount to preview the bet.</>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold">Save your bet</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            No account needed. Your name and PIN let you reopen it on another device.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Your name</span>
            <input
              name="name"
              data-testid="creator-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              autoComplete="nickname"
              placeholder="Alex"
              className="h-11 rounded-lg border border-border bg-card px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-4 focus:ring-foreground/5"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <LockKeyhole aria-hidden="true" className="size-3" /> 4-digit PIN
            </span>
            <input
              name="pin"
              data-testid="creator-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="new-password"
              placeholder="••••"
              className="h-11 rounded-lg border border-border bg-card px-3 text-center font-mono tracking-[0.35em] outline-none transition focus:border-foreground/30 focus:ring-4 focus:ring-foreground/5"
            />
          </label>
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        data-testid="create-bet"
        disabled={pending || !valid}
        className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Creating your bet…" : "Create the share link"}
        {!pending ? <ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" /> : null}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Track-only IOUs between friends. No deposits, fees, or real-money trading.
      </p>

      <span className="sr-only">
        Selected market: {title}{outcome ? `, ${outcome}` : ""}
      </span>
    </form>
  );
}
