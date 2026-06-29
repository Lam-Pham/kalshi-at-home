import Link from "next/link";
import { redirect } from "next/navigation";
import { getRoomByCode, getCurrentMember } from "@/lib/session";
import { PasteLink } from "@/components/paste-link";

export const dynamic = "force-dynamic";

export default async function FindPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const group = await getRoomByCode(code);
  if (!group) redirect("/");
  const me = await getCurrentMember(group.id);
  if (!me) redirect(`/room/${code}`);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <Link
          href={`/room/${code}`}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Find a market</h1>
        <p className="text-sm text-muted-foreground">
          Paste a Kalshi market link, then post an offer for the room.
        </p>
      </header>

      <PasteLink code={code} />
    </main>
  );
}
