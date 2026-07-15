// Thin typed client for Kalshi's public market-read API.
//
// Public market reads need NO auth. Prices come back as DOLLAR STRINGS in
// `*_dollars` fields (e.g. yes_ask_dollars: "0.2900") = implied probability,
// 0..1. `result` is "" until the market settles, then "yes" / "no".
//
// Browser-direct calls are CORS-blocked, so the app always reaches Kalshi
// through our own backend (route handlers / server components).

const KALSHI_BASE = "https://external-api.kalshi.com/trade-api/v2";

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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`${KALSHI_BASE}/markets/${encodeURIComponent(ticker)}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const body = (await res.json()) as { market?: RawMarket };
      if (!body.market) throw new Error(`Kalshi market ${ticker} → no market in response`);
      return normalize(body.market);
    }
    if (res.status !== 429 || attempt === 2) {
      throw new Error(`Kalshi market ${ticker} → HTTP ${res.status}`);
    }
    // Kalshi's public read bucket does not send Retry-After; use a short
    // exponential pause before rechecking the live price.
    await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 300 : 1_200));
  }
  throw new Error(`Kalshi market ${ticker} → exhausted retries`);
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

// ── Discovery: lightweight catalog + paste-a-link resolution ────────────────
//
// Kalshi has no public text-search endpoint. For the human-friendly picker we
// fetch a bounded slice of the open-events catalog, search it locally, and keep
// paste-a-link as the exact fallback for long-tail markets. The server always
// re-fetches a selected market before creating or taking a bet.

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

function eventSearchText(event: KalshiEvent): string {
  return [
    event.title,
    event.subTitle,
    event.category,
    event.eventTicker,
    ...event.markets.flatMap((market) => [market.title, market.yesSubTitle, market.ticker]),
  ]
    .join(" ")
    .toLowerCase();
}

/** Treat the everyday name and market shorthand as the same search term. */
function searchTermGroups(query: string): string[][] {
  const aliases: Record<string, string[]> = {
    bitcoin: ["bitcoin", "btc"],
    btc: ["btc", "bitcoin"],
    ethereum: ["ethereum", "eth"],
    eth: ["eth", "ethereum"],
    solana: ["solana", "sol"],
    sol: ["sol", "solana"],
  };
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => aliases[word] ?? [word]);
}

function textMatchesQuery(text: string, query: string): boolean {
  return searchTermGroups(query).every((group) => group.some((term) => text.includes(term)));
}

function searchScore(event: KalshiEvent, query: string): number {
  if (!query) return Math.log10(event.volume24h + 1);
  const title = event.title.toLowerCase();
  const groups = searchTermGroups(query);
  const haystack = eventSearchText(event);
  if (!textMatchesQuery(haystack, query)) return -1;

  let score = Math.log10(event.volume24h + 1);
  if (title === query) score += 100;
  else if (title.startsWith(query)) score += 50;
  else if (title.includes(query)) score += 25;
  score += groups.filter((group) => group.some((word) => title.includes(word))).length * 5;
  return score;
}

function prioritizeMarkets(event: KalshiEvent, query: string): KalshiEvent {
  if (!query) return { ...event, markets: event.markets.slice(0, 14) };
  const markets = [...event.markets]
    .sort((a, b) => {
      const aText = `${a.title} ${a.yesSubTitle} ${a.ticker}`.toLowerCase();
      const bText = `${b.title} ${b.yesSubTitle} ${b.ticker}`.toLowerCase();
      const aMatch = textMatchesQuery(aText, query) ? 1 : 0;
      const bMatch = textMatchesQuery(bText, query) ? 1 : 0;
      return bMatch - aMatch || b.volume24h - a.volume24h;
    })
    .slice(0, 18);
  return { ...event, markets };
}

const CURATED_MARKETS = [
  { ticker: "KXPRESPERSON-28-RDES", category: "Elections", search: "2028 president presidential election winner desantis politics" },
  { ticker: "KXNEXTAG-29-TBLA", category: "Politics", search: "trump next attorney general todd blanche politics" },
  { ticker: "CHINAUSGDP-30", category: "Economics", search: "china usa us gdp economy economics 2030" },
  { ticker: "KXBOND-30-AP", category: "Entertainment", search: "next james bond actor cast aaron pierre entertainment movie film" },
  { ticker: "KXOAIANTH-40-ANTH", category: "Financials", search: "openai anthropic ipo first financials company" },
  { ticker: "KXWCHOST-2038-USA", category: "Sports", search: "2038 fifa world cup host usa sports soccer" },
  { ticker: "APPLEUS-29DEC31", category: "Companies", search: "apple monopoly court companies technology" },
  { ticker: "KXELONMARS-99", category: "World", search: "elon musk visit mars world space" },
  { ticker: "KXSPACEXMARS-30", category: "Science and Technology", search: "spacex land mars science technology space" },
  { ticker: "KXFDATYPE1DIABETES-33", category: "Health", search: "fda cure type 1 diabetes health" },
  { ticker: "KXBTCMAXY-26DEC31-139999.99", category: "Crypto", search: "bitcoin btc price crypto 2026" },
  { ticker: "KXETHMAXY-27JAN01-4000.00", category: "Crypto", search: "ethereum eth price crypto 2027" },
] as const;

const curatedCache = new Map<string, { expiresAt: number; event: KalshiEvent }>();

function marketAsEvent(market: KalshiMarket, category = ""): KalshiEvent {
  return {
    eventTicker: market.eventTicker || market.ticker,
    seriesTicker: market.eventTicker.split("-")[0] ?? "",
    title: market.title,
    subTitle: "",
    category,
    mutuallyExclusive: false,
    markets: [market],
    volume24h: market.volume24h,
    closeTime: market.closeTime,
  };
}

/** Reliable popular-market fallback when Kalshi rate-limits its catalog API. */
async function curatedEvents(now: number, query: string): Promise<KalshiEvent[]> {
  const candidates = (query
    ? CURATED_MARKETS.filter((item) =>
        textMatchesQuery(`${item.search} ${item.ticker}`.toLowerCase(), query),
      )
    : CURATED_MARKETS.slice(0, 6)
  ).slice(0, 4);
  const results = await Promise.allSettled(
    candidates.map(async ({ ticker, category }) => {
      const cached = curatedCache.get(ticker);
      if (cached && cached.expiresAt > now) return cached.event;
      const market = await fetchMarket(ticker);
      if (!isBettable(market, now)) return null;
      const event = marketAsEvent(market, category);
      curatedCache.set(ticker, { event, expiresAt: now + 60_000 });
      return event;
    }),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : [],
  );
}

/**
 * Browse or search a bounded open-events catalog. Anonymous catalog reads can
 * be rate-limited independently from single-market reads, so one catalog page
 * is merged with a small, freshly priced fallback set. Exact Kalshi URLs remain
 * available for anything outside the sampled catalog.
 */
export async function discoverEvents(rawQuery: string): Promise<KalshiEvent[]> {
  const query = rawQuery.trim().toLowerCase();
  const now = Date.now();

  // Common searches can skip the heavier catalog call entirely. This both
  // feels faster and preserves Kalshi's anonymous read budget for long-tail
  // discovery.
  if (query) {
    const focused = await curatedEvents(now, query);
    if (focused.length > 0) {
      return focused
        .sort((a, b) => searchScore(b, query) - searchScore(a, query) || byVolume(a, b))
        .map((event) => prioritizeMarkets(event, query));
    }
  }

  const events: KalshiEvent[] = [];
  const seen = new Set<string>();
  const params = new URLSearchParams({
    status: "open",
    with_nested_markets: "true",
    limit: "100",
  });

  try {
    const res = await fetch(`${KALSHI_BASE}/events?${params.toString()}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const body = (await res.json()) as { events?: RawEvent[] };
      for (const raw of body.events ?? []) {
        if (seen.has(raw.event_ticker)) continue;
        seen.add(raw.event_ticker);
        const event = normalizeEvent(raw, now);
        if (event.markets.length > 0 && searchScore(event, query) >= 0) events.push(event);
      }
    }
  } catch {
    // The exact-market fallback below is intentionally independent of this API.
  }

  if (events.length < 6) {
    for (const event of await curatedEvents(now, query)) {
      if (seen.has(event.eventTicker) || searchScore(event, query) < 0) continue;
      seen.add(event.eventTicker);
      events.push(event);
    }
  }

  return events
    .sort((a, b) => searchScore(b, query) - searchScore(a, query) || byVolume(a, b))
    .slice(0, 18)
    .map((event) => prioritizeMarkets(event, query));
}

/** Fetch a single event (fresh) by its ticker, with its bettable markets. */
export async function fetchEvent(eventTicker: string): Promise<KalshiEvent | null> {
  const res = await fetch(
    `${KALSHI_BASE}/events/${encodeURIComponent(eventTicker)}?with_nested_markets=true`,
    { cache: "no-store", headers: { accept: "application/json" } },
  );
  if (!res.ok) return null;
  // Kalshi has returned both shapes here. Some responses include an empty
  // sibling `markets` array while the real outcomes live on `event.markets`,
  // so only prefer the sibling collection when it actually has outcomes.
  const body = (await res.json()) as { event?: RawEvent; markets?: RawMarket[] };
  if (!body.event) return null;
  const markets = body.markets?.length ? body.markets : body.event.markets;
  const ev = normalizeEvent({ ...body.event, markets }, Date.now());
  return ev.markets.length > 0 ? ev : null;
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
  let bareTicker = "";

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
    bareTicker = t;
    const depth = (t.match(/-/g) ?? []).length;
    if (depth >= 2) marketTicker = t;
    else if (depth === 1) eventTicker = t;
    else seriesTicker = t;
  }

  // An event ticker is a market ticker minus its last segment.
  if (marketTicker && !eventTicker) {
    eventTicker = marketTicker.split("-").slice(0, -1).join("-");
  }

  // 1) Exact market → avoid the heavier event catalog entirely.
  const exactTicker = marketTicker || bareTicker;
  if (exactTicker) {
    try {
      const market = await fetchMarket(exactTicker);
      if (isBettable(market)) return [marketAsEvent(market)];
    } catch {
      // Fall through to event/series resolution for a helpful empty result.
    }
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
