"use client";

import { useActionState } from "react";
import { recordSettlement, type ActionState } from "@/app/actions/settlements";

const initial: ActionState = {};

/** Logs a suggested transfer as paid, netting it out of the ledger. */
export function MarkPaid({
  code,
  fromId,
  toId,
  amount,
  returnTo,
}: {
  code: string;
  fromId: string;
  toId: string;
  amount: number;
  returnTo?: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordSettlement.bind(null, code, fromId, toId, amount, returnTo ?? `/room/${code}`),
    initial,
  );

  return (
    <form action={formAction} className="contents">
      <button
        type="submit"
        disabled={pending}
        title={state.error ?? "Mark this payment as done"}
        className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
      >
        {pending ? "…" : "Mark paid"}
      </button>
    </form>
  );
}
