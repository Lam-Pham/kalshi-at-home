import Link from "next/link";
import { getMyRooms } from "@/lib/session";
import { CreateRoomForm } from "@/components/create-room-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function Home() {
  const myRooms = await getMyRooms();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">kalshi-friends</h1>
        <p className="text-balance text-sm text-muted-foreground">
          Bet against your friends on real Kalshi odds. No money — just IOUs you
          settle on Venmo.
        </p>
      </header>

      {myRooms.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your rooms
          </h2>
          <ul className="flex flex-col gap-2">
            {myRooms.map(({ group, me }) => (
              <li key={group.id}>
                <Link
                  href={`/room/${group.inviteCode}`}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:bg-muted"
                >
                  <span className="font-medium">{group.name}</span>
                  <span className="text-muted-foreground">as {me.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Start a room</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateRoomForm />
        </CardContent>
      </Card>

      <footer className="text-center text-[11px] leading-relaxed text-muted-foreground/60">
        Got an invite link? Just open it to join.
        <span className="px-1">·</span>
        <Link href="/demo" className="underline underline-offset-2">
          live price demo
        </Link>
      </footer>
    </main>
  );
}
