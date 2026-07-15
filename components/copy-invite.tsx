"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// The room URL doubles as the invite link. We build the absolute URL on the
// client (origin isn't known at render time) and copy it to the clipboard.
export function CopyInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const link = `${window.location.origin}/room/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (e.g. insecure context) — the link is shown
      // below, so the user can still copy it by hand.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
          /room/{code}
        </code>
        <Button type="button" variant="outline" size="lg" onClick={copy}>
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground/70">
        Anyone with this link can join and pick a name.
      </p>
    </div>
  );
}
