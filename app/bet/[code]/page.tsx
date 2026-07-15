import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, Lock, Users } from "lucide-react";
import { getCurrentMember } from "@/lib/session";
import { getSharedBet } from "@/lib/shared-bets";
import { settleRoom } from "@/lib/settle";
import { getRoomData, type OfferView } from "@/lib/room";
import { oppositeSide, type Side } from "@/lib/bets";
import { cents, usd } from "@/lib/format";
import { ShareBetButton } from "@/components/share-bet-button";
import {
  SharedBetCloseButton,
  SharedBetTakeForm,
  SharedLivePrice,
} from "@/components/shared-bet-actions";
import { SettleUp } from "@/components/settle-up";

export const dynamic = "force-dynamic";

export default async function SharedBetPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ created?: string; joined?: string }>;
}) {
  const { code: rawCode } = await params;
  const flags = await searchParams;
  const code = rawCode.toUpperCase();
  let shared = await getSharedBet(code);
  if (!shared) return <MissingBet />;

  await settleRoom(shared.group.id);
  shared = await getSharedBet(code);
  if (!shared) return <MissingBet />;

  const [me, room] = await Promise.all([
    getCurrentMember(shared.group.id),
    getRoomData(shared.group),
  ]);
  const view = room.all.find((candidate) => candidate.offer.id === shared?.offer.id);
  if (!view) return <MissingBet />;

  const { offer, market, maker, fills, remaining, spent, result } = view;
  const makerName = maker?.name ?? "A friend";
  const makerSide = offer.side as Side;
  const takerSide = oppositeSide(makerSide);
  const isMaker = me?.id === offer.makerId;
  const initialYesMid = market ? (market.yesBid + market.yesAsk) / 2 : 0.5;
  const title = market?.title ?? offer.marketTicker;
  const outcome = market?.yesSubTitle && market.yesSubTitle !== title ? market.yesSubTitle : "";
  const fillPercent = offer.maxRisk > 0 ? Math.min(100, (spent / offer.maxRisk) * 100) : 0;
  const open = offer.status === "open";
  const settled = offer.status === "settled";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-7 sm:px-8 sm:py-10">
      <nav className="mb-8 flex items-center justify-between gap-4">
        <Link
          href={shared.group.kind === "room" ? `/room/${shared.group.inviteCode}` : "/"}
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-xs font-black text-white">
            K
          </span>
          kalshi-friends
        </Link>
        <ShareBetButton makerName={makerName} marketTitle={title} />
      </nav>

      {flags.created === "1" && isMaker ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/8 p-4">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-semibold">Your bet is live</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Send this page to a friend. They only need to choose their amount and name.
            </p>
          </div>
        </div>
      ) : null}

      {flags.joined === "1" && !isMaker ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold">You’re locked in</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              This page will track the official result and who owes whom.
            </p>
          </div>
        </div>
      ) : null}

      <header className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusPill status={offer.status} />
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
            Kalshi YES <SharedLivePrice ticker={offer.marketTicker} initialYesMid={initialYesMid} />
          </span>
        </div>
        <h1 className="text-balance text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-4xl">
          {title}
        </h1>
        {outcome ? <p className="mt-2 text-base text-muted-foreground">Outcome: {outcome}</p> : null}
      </header>

      <article className="overflow-hidden rounded-2xl border border-border bg-card">
        <section className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            The challenge
          </p>
          <div className="mt-3 flex items-end justify-between gap-5">
            <div>
              <p className="text-sm text-muted-foreground">{makerName} is taking</p>
              <p className={`mt-1 text-4xl font-black tracking-[-0.05em] ${makerSide === "yes" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                {makerSide.toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Maximum loss</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{usd(offer.maxRisk)}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{usd(spent)} matched</span>
              <span>{usd(remaining)} available</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${fillPercent}%` }} />
            </div>
          </div>
        </section>

        {open && !isMaker && remaining > 0.01 ? (
          <section className="border-t border-border bg-muted/30 p-5 sm:p-6">
            <SharedBetTakeForm
              shareCode={code}
              ticker={offer.marketTicker}
              makerName={makerName}
              makerSide={makerSide}
              remaining={remaining}
              initialYesMid={initialYesMid}
              needsIdentity={!me}
            />
          </section>
        ) : null}

        {open && isMaker ? (
          <section className="border-t border-border bg-muted/30 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold">Waiting on the {takerSide.toUpperCase()} side</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Share this page. Friends choose their own stake up to the amount available.
                </p>
              </div>
              <ShareBetButton makerName={makerName} marketTitle={title} />
            </div>
            <div className="mt-4 flex justify-end">
              <SharedBetCloseButton shareCode={code} hasFills={fills.length > 0} />
            </div>
          </section>
        ) : null}

        {!open ? (
          <BetStateMessage status={offer.status} result={result} makerName={makerName} makerSide={makerSide} />
        ) : null}
      </article>

      <section className="mt-8 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Matched stakes
          </h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users aria-hidden="true" className="size-3.5" /> {fills.length} {fills.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        {fills.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {fills.map((fillView) => {
              const won = settled && result === fillView.takerSide;
              return (
                <li key={fillView.fill.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {fillView.taker?.name ?? "A friend"}{fillView.taker?.id === me?.id ? " (you)" : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fillView.takerSide.toUpperCase()} · locked at {cents(fillView.fill.lockedYesPrice)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums">{usd(fillView.fill.stake)} risk</p>
                    <p className={`mt-0.5 text-xs ${won ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {settled
                        ? won
                          ? `won ${usd(fillView.takerWin)}`
                          : `lost ${usd(fillView.fill.stake)}`
                        : `to win ${usd(fillView.takerWin)}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
            <Clock3 aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No one has taken the other side yet</p>
            <p className="mt-1 text-xs text-muted-foreground">The first confirmed stake will appear here.</p>
          </div>
        )}
      </section>

      {settled ? (
        <div className="mt-8">
          <SettleUp
            transfers={room.transfers}
            members={room.members}
            roomName={title}
            code={shared.group.inviteCode}
            returnTo={`/bet/${code}`}
          />
        </div>
      ) : null}

      <section className="mt-8 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        <InfoItem icon={<Lock aria-hidden="true" className="size-3.5" />} title="Private link">
          Only people with this link can find the bet.
        </InfoItem>
        <InfoItem icon={<Clock3 aria-hidden="true" className="size-3.5" />} title="Live odds">
          Each stake locks the price at confirmation.
        </InfoItem>
        <InfoItem icon={<ExternalLink aria-hidden="true" className="size-3.5" />} title="Kalshi oracle">
          Their official result decides the winner.
        </InfoItem>
      </section>

      <footer className="mt-10 border-t border-border pt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
        Friendly IOUs only. No deposits, real-money trading, or payment processing.
      </footer>
    </main>
  );
}

function StatusPill({ status }: { status: OfferView["offer"]["status"] }) {
  const label =
    status === "open"
      ? "Open for a friend"
      : status === "closed"
        ? "Locked"
        : status === "settled"
          ? "Resolved"
          : "Cancelled";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status === "open" ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function BetStateMessage({
  status,
  result,
  makerName,
  makerSide,
}: {
  status: OfferView["offer"]["status"];
  result: Side | "";
  makerName: string;
  makerSide: Side;
}) {
  if (status === "cancelled") {
    return (
      <div className="border-t border-border bg-muted/30 p-5 text-sm text-muted-foreground sm:p-6">
        This bet was cancelled before anyone took the other side.
      </div>
    );
  }
  if (status === "settled" && result) {
    const makerWon = result === makerSide;
    return (
      <div className="border-t border-border bg-muted/30 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Official result</p>
        <p className="mt-2 text-2xl font-bold tracking-tight">
          {result.toUpperCase()} won · {makerWon ? makerName : "the other side"} called it
        </p>
        <p className="mt-1 text-sm text-muted-foreground">The settle-up section below shows the final IOU.</p>
      </div>
    );
  }
  return (
    <div className="border-t border-border bg-muted/30 p-5 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Lock aria-hidden="true" className="size-4" /> Stakes are locked
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        No more entries. This page will update when Kalshi posts the official result.
      </p>
    </div>
  );
}

function InfoItem({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="flex items-center gap-1.5 font-semibold text-foreground">{icon}{title}</p>
      <p className="mt-1 leading-relaxed">{children}</p>
    </div>
  );
}

function MissingBet() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-xl bg-muted text-lg">?</div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">This bet link doesn’t work</h1>
      <p className="mt-2 text-sm text-muted-foreground">It may be mistyped or no longer available.</p>
      <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4">
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to kalshi-friends
      </Link>
    </main>
  );
}
