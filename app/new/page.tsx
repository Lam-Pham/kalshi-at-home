import Link from "next/link";
import { ArrowLeft, CircleCheck, Link2, Search } from "lucide-react";
import { MarketPicker } from "@/components/market-picker";
import { QuickBetForm } from "@/components/quick-bet-form";
import { fetchMarket, isBettable } from "@/lib/kalshi";
import { cacheMarket } from "@/lib/markets";
import { cents } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NewBetPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  const { ticker } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <nav className="mb-10 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-xs font-black text-white">
            K
          </span>
          kalshi-friends
        </Link>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          No account needed
        </span>
      </nav>

      <div className="mb-8 grid grid-cols-3 gap-2" aria-label="Create a bet progress">
        <ProgressStep number="1" label="Market" active={!ticker} done={!!ticker} />
        <ProgressStep number="2" label="Your bet" active={!!ticker} />
        <ProgressStep number="3" label="Share" />
      </div>

      {ticker ? <BetDetails ticker={ticker} /> : <ChooseMarket />}
    </main>
  );
}

function ChooseMarket() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Step 1 of 3
        </p>
        <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          Find a market you disagree on.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
          Search live Kalshi markets or paste a link. Kalshi supplies the odds and final result;
          your bet stays between friends.
        </p>
      </header>
      <MarketPicker />
    </div>
  );
}

async function BetDetails({ ticker }: { ticker: string }) {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(ticker)) return <MarketProblem />;

  let market;
  try {
    market = await fetchMarket(ticker);
  } catch {
    return <MarketProblem />;
  }
  if (!isBettable(market)) return <MarketProblem closed />;
  await cacheMarket(market);

  const outcome =
    market.yesSubTitle && market.yesSubTitle !== market.title ? market.yesSubTitle : "";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/new"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" /> Pick a different market
        </Link>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Step 2 of 3
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Make it yours.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose your side and cap your downside. Your friend chooses how much to take.
        </p>
      </header>

      <article className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-6 border-b border-border pb-5">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <CircleCheck aria-hidden="true" className="size-3 text-emerald-600" /> Live market
            </span>
            <span className="rounded-full bg-muted px-2 py-1 font-mono">YES {cents(market.yesMid)}</span>
          </div>
          <h2 className="text-lg font-semibold leading-snug tracking-tight sm:text-xl">
            {market.title}
          </h2>
          {outcome ? <p className="mt-1 text-sm text-muted-foreground">Outcome: {outcome}</p> : null}
        </div>

        <QuickBetForm
          ticker={market.ticker}
          title={market.title}
          outcome={outcome}
          initialYesMid={market.yesMid}
        />
      </article>

      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
        <p className="flex items-start gap-2 rounded-xl border border-border p-3">
          <Search aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Odds refresh when your
          friend confirms—not when you create the link.
        </p>
        <p className="flex items-start gap-2 rounded-xl border border-border p-3">
          <Link2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Anyone with the private
          link can view and take the other side.
        </p>
      </div>
    </div>
  );
}

function MarketProblem({ closed = false }: { closed?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <h1 className="text-xl font-semibold">{closed ? "That market just closed" : "We couldn’t load that market"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your bet wasn’t created. Pick another live market and try again.
      </p>
      <Link
        href="/new"
        className="mt-5 inline-flex h-10 items-center rounded-lg bg-foreground px-4 text-sm font-medium text-background"
      >
        Find another market
      </Link>
    </div>
  );
}

function ProgressStep({
  number,
  label,
  active = false,
  done = false,
}: {
  number: string;
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-1 rounded-full ${active || done ? "bg-foreground" : "bg-muted"}`} />
      <span className={`text-[11px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
        {done ? "✓" : number} · {label}
      </span>
    </div>
  );
}
