import Link from "next/link";
import { TakeSlice } from "@/components/take-slice";
import { CloseOffer } from "@/components/close-offer";
import { usd, cents } from "@/lib/format";
import { roundCents, type Side } from "@/lib/bets";
import type { OfferView } from "@/lib/room";

function SideBadge({ side }: { side: Side }) {
  return (
    <span
      className={
        "rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide " +
        (side === "yes"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-700 dark:text-rose-400")
      }
    >
      {side}
    </span>
  );
}

export function OfferCard({
  view,
  meId,
  code,
  bucket,
}: {
  view: OfferView;
  meId: string;
  code: string;
  bucket: "open" | "live" | "settled";
}) {
  const { offer, maker, market, fills, spent, remaining, result } = view;
  const makerSide = offer.side as Side;
  const isMaker = offer.makerId === meId;
  const makerName = maker?.name ?? "Someone";
  const title = market?.title ?? offer.marketTicker;
  const outcome =
    market && market.yesSubTitle && market.yesSubTitle !== market.title
      ? market.yesSubTitle
      : "";
  const filledPct = offer.maxRisk > 0 ? Math.min(100, (spent / offer.maxRisk) * 100) : 0;

  const makerNet =
    bucket === "settled"
      ? roundCents(
          fills.reduce(
            (sum, fv) => sum + (result === makerSide ? fv.fill.stake : -fv.takerWin),
            0,
          ),
        )
      : 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{title}</p>
          {outcome ? (
            <p className="text-xs text-muted-foreground">{outcome}</p>
          ) : null}
        </div>
        {bucket === "settled" && (result === "yes" || result === "no") ? (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Resolved <span className="uppercase text-foreground">{result}</span>
          </span>
        ) : null}
      </div>

      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {makerName}
          {isMaker ? " (you)" : ""}
        </span>
        backs <SideBadge side={makerSide} /> · {usd(offer.maxRisk)} at risk
      </p>

      {bucket === "open" ? (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/70" style={{ width: `${filledPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {usd(spent)} matched · {usd(remaining)} left
          </p>
        </div>
      ) : null}

      {fills.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-xs">
          {fills.map((fv) => {
            const takerName = fv.taker?.name ?? "Someone";
            const won = result === fv.takerSide;
            return (
              <li key={fv.fill.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-muted-foreground">
                  <span className="font-medium text-foreground">{takerName}</span>{" "}
                  <SideBadge side={fv.takerSide} /> {usd(fv.fill.stake)} @{" "}
                  {cents(fv.fill.lockedYesPrice)}
                </span>
                {bucket === "settled" ? (
                  <span
                    className={
                      "shrink-0 font-medium " +
                      (won ? "text-emerald-600" : "text-muted-foreground line-through")
                    }
                  >
                    {won ? `won ${usd(fv.takerWin)}` : `lost ${usd(fv.fill.stake)}`}
                  </span>
                ) : (
                  <span className="shrink-0 text-muted-foreground">
                    to win {usd(fv.takerWin)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : bucket === "settled" ? (
        <p className="text-xs text-muted-foreground">No takers — nothing to settle.</p>
      ) : null}

      {bucket === "settled" && fills.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {makerName} {makerNet >= 0 ? "won" : "lost"}{" "}
          <span className={makerNet >= 0 ? "text-emerald-600" : "text-foreground"}>
            {usd(Math.abs(makerNet))}
          </span>{" "}
          as maker.
        </p>
      ) : null}

      {bucket === "live" ? (
        <p className="border-t border-border pt-2 text-xs text-muted-foreground">
          Locked — riding to Kalshi&rsquo;s result.
        </p>
      ) : null}

      {bucket === "open" ? (
        isMaker ? (
          <div className="flex items-center justify-between border-t border-border pt-2">
            {offer.shareCode ? (
              <Link
                href={`/bet/${offer.shareCode}`}
                className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Open share link
              </Link>
            ) : <span />}
            <CloseOffer code={code} offerId={offer.id} hasFills={fills.length > 0} />
          </div>
        ) : remaining > 0.01 ? (
          <TakeSlice
            code={code}
            offerId={offer.id}
            ticker={offer.marketTicker}
            makerSide={makerSide}
            remaining={remaining}
            initialYesMid={market ? (market.yesBid + market.yesAsk) / 2 : undefined}
          />
        ) : null
      ) : null}
    </div>
  );
}
