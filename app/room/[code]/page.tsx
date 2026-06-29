import Link from "next/link";
import { getRoomByCode, getCurrentMember } from "@/lib/session";
import { settleRoom } from "@/lib/settle";
import { getRoomData } from "@/lib/room";
import { JoinRoomForm } from "@/components/join-room-form";
import { CopyInvite } from "@/components/copy-invite";
import { OfferCard } from "@/components/offer-card";
import { SettleUp } from "@/components/settle-up";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usd } from "@/lib/format";
import type { Group, PublicMember } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const group = await getRoomByCode(code);
  if (!group) return <RoomNotFound />;

  const me = await getCurrentMember(group.id);
  if (!me) return <JoinGate roomName={group.name} code={code} />;

  // Lazy settlement (no background jobs in v1): refresh markets behind live
  // offers and flip any that resolved, then read the now-consistent state.
  await settleRoom(group.id);
  const data = await getRoomData(group);

  return <RoomView group={group} code={code} me={me} data={data} />;
}

function RoomNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">That room doesn’t exist</h1>
      <p className="text-sm text-muted-foreground">
        The invite link may be wrong or the room was removed.
      </p>
      <Link href="/" className="text-sm underline underline-offset-2">
        Back to start
      </Link>
    </main>
  );
}

function JoinGate({ roomName, code }: { roomName: string; code: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          You’re invited to
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{roomName}</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Join this room</CardTitle>
          <CardDescription>
            Pick the name friends will see you by, plus a PIN to sign back in
            with. Already joined on another device? Use the same name + PIN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JoinRoomForm code={code} />
        </CardContent>
      </Card>
    </main>
  );
}

function RoomView({
  group,
  code,
  me,
  data,
}: {
  group: Group;
  code: string;
  me: PublicMember;
  data: Awaited<ReturnType<typeof getRoomData>>;
}) {
  const { members, open, live, settled, leaderboard, transfers } = data;
  const myBalance = leaderboard.find((r) => r.member.id === me.id)?.balance ?? 0;
  const standing = myBalance > 0.005 ? "you're up" : myBalance < -0.005 ? "you're down" : "all square";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-1">
        <Link href="/" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          ← all rooms
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          You’re in as <span className="font-medium text-foreground">{me.name}</span>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardDescription>Your net balance · {standing}</CardDescription>
          <CardTitle
            className={
              "font-mono text-3xl tabular-nums " +
              (myBalance > 0.005
                ? "text-emerald-600"
                : myBalance < -0.005
                  ? "text-rose-600"
                  : "")
            }
          >
            {myBalance < 0 ? `-${usd(Math.abs(myBalance))}` : usd(myBalance)}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Leaderboard */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Leaderboard · {members.length} {members.length === 1 ? "player" : "players"}
        </h2>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {leaderboard.map(({ member, balance }) => (
            <li key={member.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className={member.id === me.id ? "font-medium" : ""}>
                {member.name}
                {member.id === me.id ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                ) : null}
              </span>
              <span
                className={
                  "font-mono tabular-nums " +
                  (balance > 0.005
                    ? "text-emerald-600"
                    : balance < -0.005
                      ? "text-rose-600"
                      : "text-muted-foreground")
                }
              >
                {balance < 0 ? `-${usd(Math.abs(balance))}` : usd(balance)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <SettleUp transfers={transfers} members={members} roomName={group.name} code={code} />

      {/* Bets */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bets
          </h2>
          <Link href={`/room/${code}/find`} className={buttonVariants({ size: "sm" })}>
            + New offer
          </Link>
        </div>

        <Bucket title="Open" empty="No open offers — post one to get going.">
          {open.map((v) => (
            <OfferCard key={v.offer.id} view={v} meId={me.id} code={code} bucket="open" />
          ))}
        </Bucket>

        {live.length > 0 ? (
          <Bucket title="Live">
            {live.map((v) => (
              <OfferCard key={v.offer.id} view={v} meId={me.id} code={code} bucket="live" />
            ))}
          </Bucket>
        ) : null}

        {settled.length > 0 ? (
          <Bucket title="Settled">
            {settled.map((v) => (
              <OfferCard key={v.offer.id} view={v} meId={me.id} code={code} bucket="settled" />
            ))}
          </Bucket>
        ) : null}
      </section>

      {/* Invite */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Invite friends
        </h2>
        <CopyInvite code={code} />
      </section>
    </main>
  );
}

function Bucket({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean) && items.length > 0;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {title}
      </h3>
      {hasItems ? (
        children
      ) : empty ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          {empty}
        </p>
      ) : null}
    </div>
  );
}
