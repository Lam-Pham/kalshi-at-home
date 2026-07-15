import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { discoverEvents } from "@/lib/kalshi";

export const dynamic = "force-dynamic";

const Query = z.string().trim().max(80);

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(req.nextUrl.searchParams.get("q") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: "Search is too long." }, { status: 400 });
  }

  try {
    const events = await discoverEvents(parsed.data);
    return NextResponse.json(
      { events },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "market discovery failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json({ error: "Couldn’t load live markets." }, { status: 502 });
  }
}
