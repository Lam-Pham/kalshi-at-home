import { MarkPaid } from "@/components/mark-paid";
import { usd } from "@/lib/format";
import type { Transfer } from "@/lib/bets";
import type { PublicMember } from "@/db/schema";

// Venmo has no public "pay a name" API and our identities are name-only (no
// handles), so we open Venmo prefilled with the amount + a note; the payer
// picks the recipient there. No money ever moves through this app.
function venmoUrl(amount: number, note: string): string {
  const u = new URL("https://venmo.com/");
  u.searchParams.set("txn", "pay");
  u.searchParams.set("amount", amount.toFixed(2));
  u.searchParams.set("note", note);
  return u.toString();
}

export function SettleUp({
  transfers,
  members,
  roomName,
  code,
}: {
  transfers: Transfer[];
  members: PublicMember[];
  roomName: string;
  code: string;
}) {
  if (transfers.length === 0) return null;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Someone";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Settle up
      </h2>
      <ul className="flex flex-col gap-2">
        {transfers.map((t, i) => (
          <li
            key={`${t.fromId}-${t.toId}-${i}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
          >
            <span>
              <span className="font-medium">{nameOf(t.fromId)}</span> pays{" "}
              <span className="font-medium">{nameOf(t.toId)}</span>{" "}
              <span className="font-mono tabular-nums">{usd(t.amount)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <a
                href={venmoUrl(t.amount, `${roomName} · pay ${nameOf(t.toId)}`)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
              >
                Venmo
              </a>
              <MarkPaid code={code} fromId={t.fromId} toId={t.toId} amount={t.amount} />
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground/60">
        Venmo opens prefilled with the amount — pick the person there. Hit “Mark
        paid” once it’s settled to clear it from the ledger. No money touches this app.
      </p>
    </section>
  );
}
