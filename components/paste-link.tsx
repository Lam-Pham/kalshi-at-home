"use client";

import { useState } from "react";
import Link from "next/link";
import { type KalshiEvent } from "@/lib/kalshi";
import { usd, cents } from "@/lib/format";

const fetcher = (url: string): Promise<{ events?: KalshiEvent[] }> =>
  fetch(url).then((r) => r.json());

export function PasteLink({ code }: { code: string }) {
  const [link, setLink] = useState("");
  const [events, setEvents] = useState<KalshiEvent[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(ticker: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  async function resolve(e: React.FormEvent) {
    e.preventDefault();
    if (!link.trim()) return;
    setResolving(true);
    setError(null);
    try {
      const r = await fetcher(`/api/resolve?url=${encodeURIComponent(link.trim())}`);
      const found = r.events ?? [];
      setEvents(found);
      setExpanded(new Set(found.map((ev) => ev.eventTicker)));
      if (found.length === 0) {
        setError("No bettable markets found for that link — check it and try again.");
      }
    } catch {
      setError("Couldn’t resolve that link — check it and try again.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={resolve} className="flex items-center gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Paste a Kalshi link"
          className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          disabled={resolving || !link.trim()}
          className="h-10 shrink-0 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {resolving ? "…" : "Go"}
        </button>
      </form>

      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}

      {events && events.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {events.map((ev) => (
            <EventRow
              key={ev.eventTicker}
              code={code}
              event={ev}
              expanded={expanded.has(ev.eventTicker)}
              onToggle={() => toggle(ev.eventTicker)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EventRow({
  code,
  event,
  expanded,
  onToggle,
}: {
  code: string;
  event: KalshiEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const single = event.markets.length === 1;

  // A binary (single-market) event links straight to posting on that market.
  if (single) {
    const m = event.markets[0];
    return (
      <li>
        <Link
          href={`/room/${code}/post?ticker=${encodeURIComponent(m.ticker)}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{event.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {m.yesSubTitle ? `${m.yesSubTitle} · ` : ""}
              {event.category} · {usd(event.volume24h)} traded
            </p>
          </div>
          <span className="shrink-0 font-mono text-sm tabular-nums">{cents(m.yesMid)}</span>
        </Link>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{event.title}</p>
          <p className="text-xs text-muted-foreground">
            {event.category} · {event.markets.length} outcomes · {usd(event.volume24h)} traded
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{expanded ? "Hide" : "View"}</span>
      </button>
      {expanded ? (
        <ul className="flex flex-col border-t border-border">
          {event.markets.map((m) => (
            <li key={m.ticker}>
              <Link
                href={`/room/${code}/post?ticker=${encodeURIComponent(m.ticker)}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  {m.yesSubTitle || m.title}
                </span>
                <span className="shrink-0 font-mono tabular-nums">{cents(m.yesMid)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
