import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveLink } from "@/lib/kalshi";
import { cacheMarkets } from "@/lib/markets";

export const dynamic = "force-dynamic";

const Query = z.object({ url: z.string().min(1).max(300) });

// Paste-a-link: resolve a Kalshi market URL (or bare ticker) to its events.
export async function GET(req: NextRequest) {
  const parsed = Query.safeParse({ url: req.nextUrl.searchParams.get("url") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }
  try {
    const events = await resolveLink(parsed.data.url);
    // The next step loads a single selected market. Persist every quote we
    // just showed so a transient Kalshi throttle cannot strand that handoff.
    try {
      await cacheMarkets(events.flatMap((event) => event.markets));
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "resolved market cache failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
