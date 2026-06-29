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

/** Poll the cached Kalshi proxy every 3s; returns the latest normalized market. */
export function useLivePrice(
  ticker: string,
  initial?: KalshiMarket,
): KalshiMarket | undefined {
  const { data } = useSWR<MarketResponse>(`/api/markets/${ticker}`, fetcher, {
    refreshInterval: 3000,
    fallbackData: initial
      ? { market: initial, source: "init", fetchedAt: 0 }
      : undefined,
  });
  return data?.market;
}
