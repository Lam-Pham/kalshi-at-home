import { fetchFeaturedMarket } from "@/lib/kalshi";
import { cacheMarket, countCachedMarkets } from "@/lib/markets";
import { LivePrice } from "@/components/live-price";

export const dynamic = "force-dynamic";

// Slice 1 proof, preserved: one real live Kalshi price end-to-end
// (CF runtime → cached /api proxy → D1 → clean UI).
export default async function Demo() {
  const featured = await fetchFeaturedMarket();
  if (featured) await cacheMarket(featured);
  const cached = await countCachedMarkets();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-16 px-6 py-16">
      {featured ? (
        <LivePrice ticker={featured.ticker} initial={featured} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No bettable market available right now — try again shortly.
        </p>
      )}

      <footer className="text-center text-[11px] leading-relaxed text-muted-foreground/60">
        <div>kalshi-friends · slice 1 pipe demo</div>
        <div>
          Cloudflare runtime → D1 ({cached} cached) → Kalshi
        </div>
      </footer>
    </main>
  );
}
