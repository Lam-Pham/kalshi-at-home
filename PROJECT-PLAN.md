# kalshi-friends — Project Plan & Build Brief

> Self-contained handoff doc. A fresh Claude Code session should read this first, then start **Slice 1**.

## Concept

A private app where a group of friends bet **against each other** on real Kalshi markets.
Kalshi is used only as an **oracle**: its live market price sets the odds, and its official
`result` (`yes`/`no`) decides the winner. **No real money touches the app** — it's a social
IOU ledger ("Splitwise meets a prediction market"). Friends settle up via Venmo outside the app.

## Core mechanic — open offers, live-priced slices

- A **maker** posts a *standing offer*: a side (`yes`/`no`) + **max risk in dollars** (no price).
- Any number of friends take **slices** of the other side until the maker's risk budget fills.
  Each taker sets **what they risk** (their stake). Maker is only liable for filled slices.
- **Per-fill live pricing:** each slice locks the **live Kalshi yes mid-price** `(yes_bid+yes_ask)/2`
  at the instant it's taken — different takers can get different prices. The maker's side of each
  slice is priced at that same instant, so the maker ends up holding a book of slices at different
  prices. **Integrity rule: the server re-fetches the live price at confirm time** (never trust the
  client's possibly-stale displayed price).
- **Locked until resolution** (v1): once struck, a slice holds to Kalshi's final result. No
  mark-to-market / cash-out in v1 (that's a v2 feature needing a live P&L engine).
- **True-odds pot math** (per fill, at live yes-prob `p` in 0..1): a YES taker staking `$Y` is
  matched by maker NO risk `Y*(1-p)/p`; winner takes the pot. Favorite risks more to win less;
  underdog risks less to win more. (Symmetric if maker is YES.)

## Other locked decisions

- **Money:** track-only IOUs; settle via Venmo. Never custody funds.
- **Identity:** display name + device cookie. No login/password/email. New device = rejoin via invite link.
- **Aesthetic:** deadsimplesites-style — extremely minimal, heavy whitespace, near-monochrome with
  one accent, no gradient/shadow clutter, content-first. **shadcn/ui** (new-york style, neutral base).
- **Live odds:** on-demand fetch + ~3s cache (no Durable Object / cron at friends scale). Client polls via SWR.
- **Resolution:** lazy on Room load — refresh markets behind open offers/fills and settle any with a `result`.

## Stack

- **Next.js 16** (App Router, React 19, Tailwind v4) — NOTE: Next 16 has breaking changes; read
  `node_modules/next/dist/docs/` before writing route handlers / server components.
- **Deploy:** Cloudflare Workers via `@opennextjs/cloudflare`. Bindings via `getCloudflareContext().env`.
  Needs `wrangler.jsonc`, `open-next.config.ts`, `initOpenNextCloudflareForDev()` in `next.config.ts`,
  `wrangler types`. (Adapter lags Next releases; Next 16 `proxy.ts`/Node-middleware not fully supported —
  use `middleware.ts` if needed.)
- **DB:** Cloudflare **D1** (SQLite) + **Drizzle**. Migrations: `drizzle-kit generate` →
  `wrangler d1 migrations apply` (with/without `--local`). Watch the local-vs-remote path papercut.
- **Deps kept minimal:** drizzle + D1, zod (validate every API input), swr (client polling). No auth lib,
  no state manager, no UI kit beyond shadcn.

## Data model (5 tables)

- `groups` — id, name, invite_code
- `members` — id, group_id, name
- `markets` — cache: ticker, event_ticker, title, yes_bid, yes_ask, status, result, close_ts, updated_at
- `offers` — id, group_id, market_ticker, maker_id, side(`yes`/`no`), max_risk, status(`open`/`closed`/`settled`/`cancelled`)
- `fills` — id, offer_id, taker_id, stake, locked_yes_price, created_at

Balances + leaderboard are **derived** from settled fills, never stored.

## Engineering principles

Derive-don't-duplicate · thin routes + pure domain core in `lib/bets.ts` (odds math, winner, balances —
unit-tested with Vitest) · explicit offer/fill state machines · no background jobs in v1 · vertical slices.

## Kalshi API quick reference (verified 2026-06-27)

- **Public market reads need NO auth/keys.** Working host: `https://api.elections.kalshi.com/trade-api/v2`
  (docs also list `external-api.kalshi.com`; confirm at build). Browser-direct blocked by CORS → proxy through our backend.
- Price is 1–99¢ = implied probability. Use yes mid. `result` is `""` until settled, then `yes`/`no`.
- **Discovery — NO text-search endpoint exists.** Build our own: cache the **open-events catalog**
  (`GET /events?status=open&with_nested_markets=true&limit=200`, paginate — only low-thousands, refresh
  via `min_updated_ts`), search by title substring locally. **Trending** = client-side sort by `volume_24h_fp`,
  deduped to event. **14 categories** via `GET /search/tags_by_categories` (also gives category→tags nav tree):
  Climate and Weather, Commodities, Companies, Crypto, Economics, Elections, Entertainment, Financials,
  Mentions, Politics, Science and Technology, Social, Sports, World. Events can't be filtered by category
  server-side (bucket client-side); series can (`GET /series?category=…`). Use **`mve_filter=exclude`** on
  `GET /markets` to drop combo/parlay markets. **Bettable** = open + future close + liquidity>0 + non-multivariate.
  Kalshi is ~80% sports by volume. **URL→ticker:** first path segment after `/markets/` is the lowercased
  series ticker → resolve via `GET /events?series_ticker=…`. Ticker hierarchy: `KXHIGHNY` (series) →
  `KXHIGHNY-24JAN01` (event) → `KXHIGHNY-24JAN01-T60` (market).
- WebSocket would force RSA auth → avoid it; poll REST instead.
- Note Kalshi's separate **Data Terms of Service** if this ever goes public/commercial.

## UX flow (screens)

Create room → share invite link → friend enters name (cookie) → **The Room** (your balance, leaderboard,
Open/Live/Settled buckets) → **Find a market** (Trending feed → category chips → local search → paste-a-link;
event→outcome drill-down) → **Post an offer** (side + max risk; "risk $X to win $Y" plain English) →
friends **take slices** (live-priced) → Kalshi resolves → **lazy auto-settle** → leaderboard + **settle up via Venmo**.

## Build slices (vertical, each ships something real)

1. **Pipe works** — wire `@opennextjs/cloudflare` + D1 + Drizzle into the scaffold; install shadcn;
   render ONE real live Kalshi price end-to-end (CF runtime → cached `/api` proxy → clean UI).
2. **Group + identity** — create group, invite link, enter name (cookie).
3. **Discovery + the bet** — browse/search markets → post offer → take live-priced slices → line locks.
4. **Payoff** — lazy-settle from Kalshi `result` → leaderboard + net balances + settle-up.

Deferred to v2: cash-out vs live line, real cross-device login, push notifications, charts.

## START HERE (next session)

The dir may be empty except `.claude/` + this file. Scaffold a fresh Next.js 16 app here (stock
`create-next-app`; the old `~/Desktop/kalshi-at-home` scaffold was just default create-next-app, nothing custom),
then begin **Slice 1**. Confirm the Kalshi host returns data with: `curl "https://api.elections.kalshi.com/trade-api/v2/markets?limit=1&status=open"`.
