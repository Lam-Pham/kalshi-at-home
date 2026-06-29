"use client";

import { useActionState } from "react";
import { closeOffer, type ActionState } from "@/app/actions/bets";
import { Button } from "@/components/ui/button";

const initial: ActionState = {};

export function CloseOffer({
  code,
  offerId,
  hasFills,
}: {
  code: string;
  offerId: string;
  hasFills: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    closeOffer.bind(null, code, offerId),
    initial,
  );

  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : hasFills ? "Stop taking bets" : "Cancel offer"}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
