"use client";

import useSWR from "swr";
import type { KalshiMarket } from "@/lib/kalshi";

type MarketResponse = {
  market: KalshiMarket;
  source: "live" | "cache" | "stale" | "init";
  fetchedAt: number;
};

const fetcher = (url: string): Promise<MarketResponse> =>
  fetch(url).then((r) => r.json());

export function LivePrice({
  ticker,
  initial,
}: {
  ticker: string;
  initial: KalshiMarket;
}) {
  const { data } = useSWR<MarketResponse>(`/api/markets/${ticker}`, fetcher, {
    refreshInterval: 3000,
    fallbackData: { market: initial, source: "init", fetchedAt: 0 },
  });

  const m = data?.market ?? initial;
  const pct = (m.yesMid * 100).toFixed(0);
  const bid = (m.yesBid * 100).toFixed(0);
  const ask = (m.yesAsk * 100).toFixed(0);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        live · updates every 3s
      </div>

      <h1 className="max-w-md text-balance text-xl font-medium leading-snug">
        {m.title}
        {m.yesSubTitle && m.yesSubTitle !== m.title ? (
          <span className="block text-sm font-normal text-muted-foreground">
            {m.yesSubTitle}
          </span>
        ) : null}
      </h1>

      <div className="flex items-end gap-2">
        <span className="font-mono text-7xl font-semibold tabular-nums">{pct}</span>
        <span className="pb-3 text-2xl text-muted-foreground">%</span>
      </div>
      <div className="-mt-4 text-xs uppercase tracking-widest text-muted-foreground">
        chance of yes
      </div>

      <div className="font-mono text-sm text-muted-foreground tabular-nums">
        bid {bid}¢ · ask {ask}¢
      </div>

      <div className="text-[11px] text-muted-foreground/70">{m.ticker}</div>
    </div>
  );
}
