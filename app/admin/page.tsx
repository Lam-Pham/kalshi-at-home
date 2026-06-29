import { isAdmin, getAdminOverview, type AdminRoom } from "@/lib/admin";
import {
  adminLogout,
  adminRenameMember,
  adminResetPin,
  adminRelinkMember,
  adminDeleteMember,
  adminRotateInvite,
  adminVoidOffer,
  adminDeleteSettlement,
  adminDeleteRoom,
} from "@/app/actions/admin";
import { AdminGate } from "@/components/admin-gate";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

const chip =
  "rounded-lg border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted";
const danger =
  "rounded-lg border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
        <header className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">God mode. Enter the PIN.</p>
        </header>
        <AdminGate />
      </main>
    );
  }

  const rooms = await getAdminOverview();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            {rooms.length} {rooms.length === 1 ? "room" : "rooms"} · god mode
          </p>
        </div>
        <form action={adminLogout}>
          <button type="submit" className={chip}>
            Lock
          </button>
        </form>
      </header>

      {rooms.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No rooms yet.
        </p>
      ) : (
        rooms.map((room) => <RoomBlock key={room.id} room={room} />)
      )}
    </main>
  );
}

function RoomBlock({ room }: { room: AdminRoom }) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{room.name}</CardTitle>
          <div className="flex shrink-0 gap-2">
            <form action={adminRotateInvite.bind(null, room.id)}>
              <button type="submit" className={chip}>
                Rotate code
              </button>
            </form>
            <ConfirmButton
              action={adminDeleteRoom.bind(null, room.id)}
              label="Delete room"
              confirm={`Delete "${room.name}" and ALL its bets and history? This can't be undone.`}
              className={danger}
            />
          </div>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          invite code: {room.inviteCode}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Members */}
        <Section title={`Members (${room.members.length})`}>
          {room.members.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0"
            >
              <span className="min-w-24 text-sm font-medium">{m.name}</span>
              <form action={adminRenameMember.bind(null, m.id)} className="flex gap-1">
                <input
                  name="name"
                  placeholder="rename…"
                  maxLength={40}
                  className="h-7 w-28 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring"
                />
                <button type="submit" className={chip}>
                  Rename
                </button>
              </form>
              <form action={adminResetPin.bind(null, m.id)} className="flex gap-1">
                <input
                  name="pin"
                  placeholder="new PIN"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  className="h-7 w-20 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:border-ring"
                />
                <button type="submit" className={chip}>
                  Set PIN
                </button>
              </form>
              <form action={adminRelinkMember.bind(null, m.id)}>
                <button type="submit" className={chip} title="Sign this device in as them">
                  Relink
                </button>
              </form>
              <ConfirmButton
                action={adminDeleteMember.bind(null, m.id)}
                label="Delete"
                confirm={`Delete ${m.name}? (Only works if they have no bet history.)`}
                className={danger}
              />
            </div>
          ))}
        </Section>

        {/* Bets */}
        {room.offers.length > 0 ? (
          <Section title={`Bets (${room.offers.length})`}>
            {room.offers.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="uppercase text-muted-foreground">{o.side}</span>{" "}
                  {o.title}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {usd(o.maxRisk)} · {o.status} · {o.fillCount} fill
                    {o.fillCount === 1 ? "" : "s"}
                  </span>
                </span>
                {o.status === "open" || o.status === "closed" ? (
                  <ConfirmButton
                    action={adminVoidOffer.bind(null, o.id)}
                    label="Void"
                    confirm="Void this bet? Its slices stop counting."
                    className={danger}
                  />
                ) : null}
              </div>
            ))}
          </Section>
        ) : null}

        {/* Settlements */}
        {room.settlements.length > 0 ? (
          <Section title={`Payments (${room.settlements.length})`}>
            {room.settlements.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {s.from} → {s.to}{" "}
                  <span className="font-mono tabular-nums">{usd(s.amount)}</span>
                </span>
                <ConfirmButton
                  action={adminDeleteSettlement.bind(null, s.id)}
                  label="Undo"
                  confirm="Remove this recorded payment? Balances will go back up."
                  className={danger}
                />
              </div>
            ))}
          </Section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
