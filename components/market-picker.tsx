"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, ChevronDown, Link2, Search, TrendingUp } from "lucide-react";
import type { KalshiEvent } from "@/lib/kalshi";
import { cents, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

type DiscoveryResponse = { events?: KalshiEvent[]; error?: string };

const fetcher = async (url: string): Promise<DiscoveryResponse> => {
  const response = await fetch(url);
  const body = (await response.json()) as DiscoveryResponse;
  if (!response.ok) throw new Error(body.error ?? "Couldn’t load markets.");
  return body;
};

function requestUrl(value: string): string {
  const input = value.trim();
  const exact =
    /^https?:\/\//i.test(input) ||
    input.toLowerCase().includes("kalshi.com") ||
    /^[A-Za-z0-9._]+-[A-Za-z0-9._-]+$/.test(input);
  return exact
    ? `/api/resolve?url=${encodeURIComponent(input)}`
    : `/api/discover?q=${encodeURIComponent(input)}`;
}

export function MarketPicker() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [endpoint, setEndpoint] = useState("/api/discover?q=");
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, error, isLoading } = useSWR<DiscoveryResponse>(endpoint, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  const events = data?.events ?? [];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim();
    setQuery(next);
    setExpanded(null);
    setEndpoint(requestUrl(next));
  }

  return (
    <div className="flex flex-col gap-7">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="market-search" className="text-sm font-medium">
          What do you want to bet on?
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 ring-foreground/5 transition focus-within:border-foreground/30 focus-within:ring-4">
          <Search aria-hidden="true" className="ml-2 size-4 shrink-0 text-muted-foreground" />
          <input
            id="market-search"
            data-testid="market-search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search elections, sports, crypto…"
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-85 disabled:opacity-50"
          >
            {isLoading ? "Finding…" : "Find markets"}
          </button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link2 aria-hidden="true" className="size-3.5" />
          You can also paste any Kalshi market link or ticker.
        </p>
      </form>

      <section aria-live="polite" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {query ? <Search aria-hidden="true" className="size-3.5" /> : <TrendingUp aria-hidden="true" className="size-3.5" />}
            {query ? `Results for “${query}”` : "Popular live markets"}
          </h2>
          {!isLoading && events.length > 0 ? (
            <span className="text-xs text-muted-foreground">{events.length} events</span>
          ) : null}
        </div>

        {isLoading && events.length === 0 ? <MarketSkeleton /> : null}

        {error ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium">Markets are taking a breather</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try again, or paste the exact Kalshi link above.
            </p>
          </div>
        ) : null}

        {!isLoading && !error && events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-7 text-center">
            <p className="text-sm font-medium">No live match found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try fewer words or paste the market’s Kalshi link.
            </p>
          </div>
        ) : null}

        {events.length > 0 ? (
          <ul className={cn("flex flex-col gap-2 transition-opacity", isLoading && "opacity-55")}>
            {events.map((event) => (
              <EventChoice
                key={event.eventTicker}
                event={event}
                expanded={expanded === event.eventTicker}
                onToggle={() =>
                  setExpanded((current) =>
                    current === event.eventTicker ? null : event.eventTicker,
                  )
                }
              />
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function EventChoice({
  event,
  expanded,
  onToggle,
}: {
  event: KalshiEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const single = event.markets.length === 1;
  const market = event.markets[0];

  if (single) {
    return (
      <li>
        <MarketLink event={event} market={market} />
      </li>
    );
  }

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-muted/60"
      >
        <EventSummary event={event} />
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-muted-foreground transition", expanded && "rotate-180")}
        />
      </button>
      {expanded ? (
        <ul className="divide-y divide-border border-t border-border bg-background/35">
          {event.markets.map((choice) => (
            <li key={choice.ticker}>
              <Link
                href={`/new?ticker=${encodeURIComponent(choice.ticker)}`}
                data-testid={`market-${choice.ticker}`}
                className="group flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    {choice.yesSubTitle || choice.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {usd(choice.volume24h)} traded today
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {cents(choice.yesMid)}
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function MarketLink({ event, market }: { event: KalshiEvent; market: KalshiEvent["markets"][number] }) {
  return (
    <Link
      href={`/new?ticker=${encodeURIComponent(market.ticker)}`}
      data-testid={`market-${market.ticker}`}
      className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-foreground/25 hover:bg-muted/50"
    >
      <EventSummary event={event} outcome={market.yesSubTitle} />
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums">{cents(market.yesMid)}</span>
        <ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function EventSummary({ event, outcome }: { event: KalshiEvent; outcome?: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2">
        {event.category ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {event.category}
          </span>
        ) : null}
        <span className="text-[11px] text-muted-foreground">{usd(event.volume24h)} today</span>
      </div>
      <p className="text-sm font-medium leading-snug">{event.title}</p>
      {outcome && outcome !== event.title ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{outcome}</p>
      ) : null}
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading markets">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-xl border border-border bg-muted/50" />
      ))}
    </div>
  );
}
