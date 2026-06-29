// Thin typed client for Kalshi's public market-read API.
//
// Public market reads need NO auth. Prices come back as DOLLAR STRINGS in
// `*_dollars` fields (e.g. yes_ask_dollars: "0.2900") = implied probability,
// 0..1. `result` is "" until the market settles, then "yes" / "no".
//
// Browser-direct calls are CORS-blocked, so the app always reaches Kalshi
// through our own backend (route handlers / server components).

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

/** Raw market object as returned by Kalshi (only the fields we use). */
type RawMarket = {
  ticker: string;
  event_ticker?: string;
  title: string;
  yes_sub_title?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  status?: string;
  result?: string;
  close_time?: string;
  liquidity_dollars?: string;
  volume_24h_fp?: string;
};

/** Our normalized market. All prices are dollars in [0, 1]. */
export type KalshiMarket = {
  ticker: string;
  eventTicker: string;
  title: string;
  yesSubTitle: string;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  /** (yesBid + yesAsk) / 2 — the live yes mid used for true-odds pricing. */
  yesMid: number;
  status: string;
  result: string;
  closeTime: string | null;
  liquidity: number;
  volume24h: number;
};

/** Parse a Kalshi dollar string ("0.2900") to a float; missing → 0. */
function dollars(s: string | undefined): number {
  const n = s == null ? 0 : Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalize(m: RawMarket): KalshiMarket {
  const yesBid = dollars(m.yes_bid_dollars);
  const yesAsk = dollars(m.yes_ask_dollars);
  return {
    ticker: m.ticker,
    eventTicker: m.event_ticker ?? "",
    title: m.title,
    yesSubTitle: m.yes_sub_title ?? "",
    yesBid,
    yesAsk,
    noBid: dollars(m.no_bid_dollars),
    noAsk: dollars(m.no_ask_dollars),
    yesMid: (yesBid + yesAsk) / 2,
    status: m.status ?? "unknown",
    result: m.result ?? "",
    closeTime: m.close_time ?? null,
    liquidity: dollars(m.liquidity_dollars),
    volume24h: dollars(m.volume_24h_fp),
  };
}

/** Fetch a single market by ticker. Throws on non-200 or missing market. */
export async function fetchMarket(ticker: string): Promise<KalshiMarket> {
  const res = await fetch(`${KALSHI_BASE}/markets/${encodeURIComponent(ticker)}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Kalshi market ${ticker} → HTTP ${res.status}`);
  }
  const body = (await res.json()) as { market?: RawMarket };
  if (!body.market) throw new Error(`Kalshi market ${ticker} → no market in response`);
  return normalize(body.market);
}

/**
 * A market we can actually offer a bet on: two-sided (real yes bid & ask), a
 * usable mid-price in (0,1), and a close still in the future. Shared by
 * discovery and bet-posting so they agree on what's bettable.
 */
export function isBettable(m: KalshiMarket, now: number = Date.now()): boolean {
  return (
    m.yesBid > 0 &&
    m.yesAsk > 0 &&
    m.yesMid > 0 &&
    m.yesMid < 1 &&
    m.closeTime != null &&
    new Date(m.closeTime).getTime() > now
  );
}

// ── Discovery: paste-a-link → event + outcomes ──────────────────────────────
//
// Markets are found by pasting a Kalshi link (or bare ticker), which we resolve
// to its open event(s) and bettable markets. Kalshi has no text-search endpoint,
// so there's no browse/search/trending feed — just direct link resolution.

type RawEvent = {
  event_ticker: string;
  series_ticker?: string;
  title: string;
  sub_title?: string;
  category?: string;
  mutually_exclusive?: boolean;
  markets?: RawMarket[];
};

/** An event plus its bettable markets, normalized for our UI. */
export type KalshiEvent = {
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subTitle: string;
  category: string;
  mutuallyExclusive: boolean;
  /** Only the markets you can actually bet on right now. */
  markets: KalshiMarket[];
  /** Summed 24h volume across bettable markets — drives "trending". */
  volume24h: number;
  /** Earliest close among bettable markets (ISO), or null. */
  closeTime: string | null;
};

function normalizeEvent(e: RawEvent, now: number): KalshiEvent {
  const markets = (e.markets ?? [])
    .map(normalize)
    .filter((m) => isBettable(m, now))
    .sort((a, b) => b.volume24h - a.volume24h);
  const closeMs = markets
    .map((m) => (m.closeTime ? new Date(m.closeTime).getTime() : Infinity))
    .filter((t) => Number.isFinite(t));
  return {
    eventTicker: e.event_ticker,
    seriesTicker: e.series_ticker ?? "",
    title: e.title,
    subTitle: e.sub_title ?? "",
    category: e.category ?? "",
    mutuallyExclusive: !!e.mutually_exclusive,
    markets,
    volume24h: markets.reduce((s, m) => s + m.volume24h, 0),
    closeTime: closeMs.length ? new Date(Math.min(...closeMs)).toISOString() : null,
  };
}

const byVolume = (a: KalshiEvent, b: KalshiEvent) => b.volume24h - a.volume24h;

/** Fetch a single event (fresh) by its ticker, with its bettable markets. */
export async function fetchEvent(eventTicker: string): Promise<KalshiEvent | null> {
  const res = await fetch(
    `${KALSHI_BASE}/events/${encodeURIComponent(eventTicker)}?with_nested_markets=true`,
    { cache: "no-store", headers: { accept: "application/json" } },
  );
  if (!res.ok) return null;
  // Single-event responses put markets as a sibling of `event`, not nested.
  const body = (await res.json()) as { event?: RawEvent; markets?: RawMarket[] };
  if (!body.event) return null;
  const ev = normalizeEvent({ ...body.event, markets: body.markets ?? body.event.markets }, Date.now());
  return ev.markets.length > 0 ? ev : null;
}

/** A single bettable market, wrapped as an event so the UI can render it. */
function singleMarketEvent(ev: KalshiEvent, m: KalshiMarket): KalshiEvent {
  return { ...ev, markets: [m], volume24h: m.volume24h, closeTime: m.closeTime };
}

/**
 * Resolve a pasted Kalshi link (or bare ticker) to its events, scoped as
 * tightly as the link allows. A Kalshi URL encodes up to three levels —
 * `/markets/<series>/<slug>/<event>?op_market_ticker=<market>` — and bare
 * tickers encode the same hierarchy as `SERIES-EVENT-MARKET`. We resolve to the
 * most specific one present: a market → just that outcome; an event → its
 * outcomes; only a series → that series' open events (several). Without this,
 * a deep link would balloon to every event in the series.
 */
export async function resolveLink(input: string): Promise<KalshiEvent[]> {
  const raw = input.trim();
  if (!raw) return [];

  let marketTicker = "";
  let eventTicker = "";
  let seriesTicker = "";

  if (/^https?:\/\//i.test(raw) || raw.includes("kalshi.com")) {
    try {
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      // Deep links carry the exact market here; the path carries series + event.
      marketTicker = (u.searchParams.get("op_market_ticker") ?? "").toUpperCase();
      const segs = u.pathname.split("/").filter(Boolean);
      const mi = segs.indexOf("markets");
      const after = (mi >= 0 ? segs.slice(mi + 1) : segs).map((s) => s.toUpperCase());
      seriesTicker = after[0] ?? "";
      // The event ticker is the deepest path segment that looks like a ticker
      // (`SERIES-…`); the human-readable slug never contains the series prefix.
      eventTicker = [...after].reverse().find((s) => s.includes("-")) ?? "";
    } catch {
      // not a URL after all — fall through to bare-ticker handling
    }
  }

  if (!marketTicker && !eventTicker && !seriesTicker) {
    // Bare ticker: classify by depth (SERIES / SERIES-EVENT / SERIES-EVENT-MARKET).
    const t = raw.toUpperCase();
    const depth = (t.match(/-/g) ?? []).length;
    if (depth >= 2) marketTicker = t;
    else if (depth === 1) eventTicker = t;
    else seriesTicker = t;
  }

  // An event ticker is a market ticker minus its last segment.
  if (marketTicker && !eventTicker) {
    eventTicker = marketTicker.split("-").slice(0, -1).join("-");
  }

  // 1) Exact market → show just that outcome.
  if (marketTicker && eventTicker) {
    const ev = await fetchEvent(eventTicker);
    const one = ev?.markets.find((m) => m.ticker === marketTicker);
    if (ev && one) return [singleMarketEvent(ev, one)];
  }

  // 2) Specific event → show its outcomes.
  if (eventTicker) {
    const ev = await fetchEvent(eventTicker);
    if (ev) return [ev];
  }

  // 3) Only a series → its open events (may be several).
  const series = seriesTicker || (eventTicker || marketTicker).split("-")[0];
  if (series) {
    const res = await fetch(
      `${KALSHI_BASE}/events?series_ticker=${encodeURIComponent(series)}&status=open&with_nested_markets=true&limit=50`,
      { cache: "no-store", headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const body = (await res.json()) as { events?: RawEvent[] };
      const now = Date.now();
      const events = (body.events ?? [])
        .map((e) => normalizeEvent(e, now))
        .filter((e) => e.markets.length > 0)
        .sort(byVolume);
      if (events.length > 0) return events;
    }
  }

  return [];
}
