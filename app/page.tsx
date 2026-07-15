import Link from "next/link";
import { ArrowRight, Check, Link2, Plus, Users } from "lucide-react";
import { getMyQuickBets, getMyRooms } from "@/lib/session";
import { CreateRoomForm } from "@/components/create-room-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [myBets, myRooms] = await Promise.all([getMyQuickBets(), getMyRooms()]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-7 sm:px-8 sm:py-10">
      <nav className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-xs font-black text-white">
            K
          </span>
          kalshi-friends
        </div>
        <span className="hidden rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
          Friendly IOUs · real Kalshi odds
        </span>
      </nav>

      <section className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.25fr_0.75fr] lg:gap-16">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Settle the group chat
          </p>
          <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
            Make the bet. Send one link.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Pick a real Kalshi market, take your side, and let a friend choose their stake.
            We track the odds, result, and IOU—without touching anyone’s money.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/new"
              data-testid="start-bet"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition hover:opacity-85"
            >
              Create a one-off bet
              <ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
            <span className="text-center text-xs text-muted-foreground sm:text-left">
              No signup · takes about a minute
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            How it works
          </p>
          <ol className="mt-5 flex flex-col gap-5">
            <HomeStep number="1" title="Choose the question">
              Search live markets or paste a Kalshi link.
            </HomeStep>
            <HomeStep number="2" title="Call your side">
              Cap what you can lose. Your friend picks their amount.
            </HomeStep>
            <HomeStep number="3" title="Let Kalshi settle it">
              Official result in, clean IOU out. Pay each other on Venmo.
            </HomeStep>
          </ol>
        </div>
      </section>

      {myBets.length > 0 || myRooms.length > 0 ? (
        <section className="border-t border-border py-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Pick up where you left off
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Your activity</h2>
            </div>
            <Link href="/new" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
              <Plus aria-hidden="true" className="size-4" /> New bet
            </Link>
          </div>

          {myBets.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {myBets.map(({ offer, market, me }) => (
                <li key={offer.id}>
                  <Link
                    href={`/bet/${offer.shareCode}`}
                    className="group flex h-full flex-col justify-between rounded-xl border border-border bg-card p-4 transition hover:border-foreground/25 hover:bg-muted/40"
                  >
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {offer.status}
                        </span>
                        <span className="text-xs text-muted-foreground">as {me.name}</span>
                      </div>
                      <p className="text-sm font-semibold leading-snug">
                        {market?.title ?? offer.marketTicker}
                      </p>
                      {market?.yesSubTitle ? (
                        <p className="mt-1 text-xs text-muted-foreground">{market.yesSubTitle}</p>
                      ) : null}
                    </div>
                    <p className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{offer.side.toUpperCase()} · up to ${offer.maxRisk.toFixed(2)}</span>
                      <ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {myRooms.length > 0 ? (
            <div className="mt-7">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Users aria-hidden="true" className="size-3.5" /> Friend rooms
              </h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {myRooms.map(({ group, me }) => (
                  <li key={group.id}>
                    <Link
                      href={`/room/${group.inviteCode}`}
                      className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm transition hover:bg-muted"
                    >
                      <span className="font-medium">{group.name}</span>
                      <span className="text-xs text-muted-foreground">as {me.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-8 border-t border-border py-10 sm:grid-cols-[1fr_1.1fr] sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Betting with the whole crew?
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Start a persistent room.</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Rooms keep a running leaderboard and settle-up ledger across multiple bets.
          </p>
          <ul className="mt-5 flex flex-col gap-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><Check className="size-3.5 text-brand" /> One invite link for the group</li>
            <li className="flex items-center gap-2"><Check className="size-3.5 text-brand" /> Open, live, and settled history</li>
            <li className="flex items-center gap-2"><Check className="size-3.5 text-brand" /> Net balances across every bet</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <CreateRoomForm />
        </div>
      </section>

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-border py-6 text-center text-[11px] text-muted-foreground sm:flex-row sm:text-left">
        <span className="inline-flex items-center gap-1.5"><Link2 className="size-3.5" /> Got an invite? Open the link to join.</span>
        <span>No custody · no fees · friends settle directly</span>
      </footer>
    </main>
  );
}

function HomeStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-3">
      <span className="grid size-8 place-items-center rounded-full border border-border bg-background font-mono text-xs font-semibold">
        {number}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
