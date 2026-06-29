"use client";

import { useActionState } from "react";
import { joinRoom, type ActionState } from "@/app/actions/rooms";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/text-field";

const initial: ActionState = {};

export function JoinRoomForm({ code }: { code: string }) {
  // Bind the invite code so the action's signature matches useActionState's
  // (prevState, formData). The code is validated server-side, never trusted here.
  const [state, formAction, pending] = useActionState(
    joinRoom.bind(null, code),
    initial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        label="Your name"
        name="yourName"
        placeholder="Alex"
        maxLength={40}
        required
        autoComplete="off"
      />
      <TextField
        label="4-digit PIN"
        name="pin"
        placeholder="••••"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        required
        autoComplete="off"
        description="New here? Pick a PIN. Coming back on a new device? Use your same name + PIN."
      />
      {state.error ? (
        <p className="text-sm text-destructive" aria-live="polite">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Joining…" : "Join room"}
      </Button>
    </form>
  );
}
