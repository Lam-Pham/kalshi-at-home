<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# kalshi-friends

Friends bet against each other on real Kalshi markets. Kalshi is only an oracle
(live price = odds; official `result` = winner). No real money — IOUs settled via
Venmo. Full spec + roadmap in `PROJECT-PLAN.md`. Build proceeds in vertical slices.

## Stack
Next.js 16 (App Router, React 19, Tailwind v4) · shadcn/ui (base-nova, neutral) ·
Cloudflare Workers via `@opennextjs/cloudflare` · D1 + Drizzle · zod · swr.

## Commands
- `npm run dev` — Next dev server (D1 works via `initOpenNextCloudflareForDev()`).
- `npm run preview` — OpenNext build + `wrangler dev` on real workerd. Truest local check.
- `npm run cf-build` — build the Workers bundle only (`.open-next/worker.js`).
- `npm run db:generate` — drizzle-kit generate SQL from `db/schema.ts`.
- `npm run db:migrate:local` / `:remote` — apply migrations via wrangler.
- `npm run cf-typegen` — regenerate `worker-configuration.d.ts` after editing `wrangler.jsonc`.

## Layout
- `lib/kalshi.ts` — typed Kalshi client. **Prices come as dollar STRINGS** in
  `*_dollars` fields ("0.2900" = 29% prob); parsed to floats in [0,1]. `yesMid =
  (yesBid+yesAsk)/2` drives true-odds pricing. `result` is "" until settled.
- `lib/db.ts` — `getDb()` → Drizzle bound to D1 (`getCloudflareContext().env.DB`).
- `db/schema.ts` — 6 tables (groups, members, markets, offers, fills, settlements).
  Prices = REAL dollars. Balances/leaderboard are DERIVED from settled fills minus
  settlements, never stored.
- `app/api/markets/[ticker]/route.ts` — cached (~3s, in-memory) Kalshi proxy; upserts to D1.
- `app/page.tsx` + `components/live-price.tsx` — Slice 1 live-price screen (SWR polls 3s).

## Gotchas (learned)
- Public Kalshi reads need NO auth. Host: `https://api.elections.kalshi.com/trade-api/v2`.
  No text-search endpoint — must cache the open-events catalog and search locally (Slice 3).
- `wrangler.jsonc` now holds the real provisioned `database_id`. Local D1 state under
  `.wrangler/state` is keyed by that id — changing it makes local dev start from an
  EMPTY database ("no such table: groups"). Re-run `db:migrate:local` after any id change.
- A stray `~/package-lock.json` confuses Next's workspace-root detection → pinned via
  `turbopack.root` in `next.config.ts`.
- Port 3000 is often already taken on this machine; dev falls back to 3001.
