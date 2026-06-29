"use client";

import { useActionState } from "react";
import { adminLogin, type ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/text-field";

const initial: ActionState = {};

export function AdminGate() {
  const [state, formAction, pending] = useActionState(adminLogin, initial);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        label="Admin PIN"
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
      />
      {state.error ? (
        <p className="text-sm text-destructive" aria-live="polite">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "Unlock"}
      </Button>
    </form>
  );
}
