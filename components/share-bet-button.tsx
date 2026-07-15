"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareBetButton({ makerName, marketTitle }: { makerName: string; marketTitle: string }) {
  const [shared, setShared] = useState(false);

  async function share() {
    const url = window.location.href.split("?")[0];
    const message = `${makerName} wants to bet you: ${marketTitle}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "A friendly bet", text: message, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 2200);
    } catch {
      // Closing the native share sheet is a normal no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      data-testid="share-bet"
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-85"
    >
      {shared ? <Check aria-hidden="true" className="size-4" /> : <Share2 aria-hidden="true" className="size-4" />}
      {shared ? "Link copied" : "Send to a friend"}
    </button>
  );
}
