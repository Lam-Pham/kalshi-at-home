"use client";

import { useActionState, useState } from "react";
import { LockKeyhole } from "lucide-react";
import {
  closeSharedBet,
  takeSharedBet,
  type QuickBetActionState,
} from "@/app/actions/quick-bets";
import { useLivePrice } from "@/components/use-live-price";
import {
  maxStakeForBudget,
  oppositeSide,
  quoteSlice,
  roundCents,
  type Side,
} from "@/lib/bets";
import { cents, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const initialState: QuickBetActionState = {};

export function SharedBetTakeForm({
  shareCode,
  ticker,
  makerName,
  makerSide,
  remaining,
  initialYesMid,
  needsIdentity,
}: {
  shareCode: string;
  ticker: string;
  makerName: string;
  makerSide: Side;
  remaining: number;
  initialYesMid: number;
  needsIdentity: boolean;
}) {
  const [state, action, pending] = useActionState(
    takeSharedBet.bind(null, shareCode),
    initialState,
  );
  const [stake, setStake] = useState("10");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const market = useLivePrice(ticker);
  const yesPrice = market?.yesMid ?? initialYesMid;
  const takerSide = oppositeSide(makerSide);
  const maxStake = roundCents(maxStakeForBudget(remaining, yesPrice, takerSide));
  const stakeNumber = Number(stake);
  const validStake = Number.isFinite(stakeNumber) && stakeNumber >= 0.01;
  const quote = validStake ? quoteSlice(makerSide, yesPrice, stakeNumber) : null;
  const overBudget = !!quote && quote.makerRisk > remaining + 0.01;
  const identityValid = !needsIdentity || (name.trim().length > 0 && /^\d{4}$/.test(pin));
  const presets = [5, 10, 25].filter((amount) => amount <= maxStake);

  return (
    <form action={action} className="flex flex-col gap-5" data-testid="take-bet-form">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Your move
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          Take {takerSide.toUpperCase()} against {makerName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the most you could lose. The live odds set what you can win.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-background p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <label htmlFor="friend-stake" className="font-medium text-foreground">
            Your maximum loss
          </label>
          <span className="font-mono tabular-nums">YES {cents(yesPrice)} live</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <input
              id="friend-stake"
              name="stake"
              data-testid="friend-stake"
              inputMode="decimal"
              value={stake}
              onChange={(event) => setStake(event.target.value)}
              aria-invalid={!validStake || overBudget}
              className="h-12 w-full rounded-lg border border-border bg-card pl-7 pr-3 font-mono text-lg font-semibold tabular-nums outline-none transition focus:border-foreground/30 focus:ring-4 focus:ring-foreground/5"
            />
          </div>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setStake(String(preset))}
              className={cn(
                "hidden h-12 min-w-13 rounded-lg border px-2 text-sm font-medium tabular-nums transition sm:block",
                stakeNumber === preset
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              ${preset}
            </button>
          ))}
        </div>
        <p className={cn("mt-3 text-sm", overBudget ? "text-destructive" : "text-muted-foreground")}>
          {quote && !overBudget ? (
            <>
              Risk <strong className="text-foreground">{usd(quote.takerRisk)}</strong> to win{" "}
              <strong className="text-emerald-700 dark:text-emerald-400">{usd(quote.takerWin)}</strong> if{" "}
              {takerSide.toUpperCase()} wins.
            </>
          ) : overBudget ? (
            <>That’s above the {usd(maxStake)} available at this price.</>
          ) : (
            <>Up to {usd(maxStake)} is available at this price.</>
          )}
        </p>
      </div>

      {needsIdentity ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Your name</span>
            <input
              name="name"
              data-testid="friend-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              autoComplete="nickname"
              placeholder="Sam"
              className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-4 focus:ring-foreground/5"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <LockKeyhole aria-hidden="true" className="size-3" /> 4-digit PIN
            </span>
            <input
              name="pin"
              data-testid="friend-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="new-password"
              placeholder="••••"
              className="h-11 rounded-lg border border-border bg-background px-3 text-center font-mono tracking-[0.35em] outline-none transition focus:border-foreground/30 focus:ring-4 focus:ring-foreground/5"
            />
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            No account. The PIN only helps you reopen this bet on another device.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        data-testid="lock-stake"
        disabled={pending || !validStake || overBudget || !identityValid}
        className="h-12 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending
          ? "Locking the live odds…"
          : validStake
            ? `Lock in ${usd(stakeNumber)} on ${takerSide.toUpperCase()}`
            : `Take ${takerSide.toUpperCase()}`}
      </button>
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        We recheck Kalshi at confirmation. Nothing here moves real money.
      </p>
    </form>
  );
}

export function SharedBetCloseButton({ shareCode, hasFills }: { shareCode: string; hasFills: boolean }) {
  const [state, action, pending] = useActionState(
    closeSharedBet.bind(null, shareCode),
    initialState,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground disabled:opacity-50"
      >
        {pending ? "Closing…" : hasFills ? "Stop taking more stakes" : "Cancel this bet"}
      </button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}

export function SharedLivePrice({ ticker, initialYesMid }: { ticker: string; initialYesMid: number }) {
  const market = useLivePrice(ticker);
  const price = market?.yesMid ?? initialYesMid;
  return <span className="font-mono font-semibold tabular-nums">{cents(price)}</span>;
}
