import Link from "next/link";
import { redirect } from "next/navigation";
import { getRoomByCode, getCurrentMember } from "@/lib/session";
import { fetchMarket, isBettable } from "@/lib/kalshi";
import { cacheMarket } from "@/lib/markets";
import { PostOfferForm } from "@/components/post-offer-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ ticker?: string }>;
}) {
  const { code } = await params;
  const { ticker } = await searchParams;

  const group = await getRoomByCode(code);
  if (!group) redirect("/");
  const me = await getCurrentMember(group.id);
  if (!me) redirect(`/room/${code}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <Link
          href={`/room/${code}/find`}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ← find a market
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Post an offer</h1>
      </header>

      {ticker ? <OfferLoader code={code} ticker={ticker} /> : <NoMarket code={code} />}
    </main>
  );
}

async function OfferLoader({ code, ticker }: { code: string; ticker: string }) {
  let market;
  try {
    market = await fetchMarket(ticker);
  } catch {
    return <Problem code={code} message="Couldn't reach Kalshi for that market." />;
  }
  if (!isBettable(market)) {
    return <Problem code={code} message="That market isn't bettable right now." />;
  }
  await cacheMarket(market);

  const outcome =
    market.yesSubTitle && market.yesSubTitle !== market.title ? market.yesSubTitle : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-snug">{market.title}</CardTitle>
        {outcome ? <p className="text-sm text-muted-foreground">{outcome}</p> : null}
      </CardHeader>
      <CardContent>
        <PostOfferForm code={code} ticker={market.ticker} initialYesMid={market.yesMid} />
      </CardContent>
    </Card>
  );
}

function NoMarket({ code }: { code: string }) {
  return <Problem code={code} message="Pick a market to post an offer on." />;
}

function Problem({ code, message }: { code: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link
        href={`/room/${code}/find`}
        className="text-sm font-medium underline underline-offset-2"
      >
        Browse markets
      </Link>
    </div>
  );
}
