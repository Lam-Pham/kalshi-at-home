"use client";

import { useActionState } from "react";
import { createRoom, type ActionState } from "@/app/actions/rooms";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/text-field";

const initial: ActionState = {};

export function CreateRoomForm() {
  const [state, formAction, pending] = useActionState(createRoom, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        label="Room name"
        name="roomName"
        placeholder="The Degenerates"
        maxLength={40}
        required
        autoComplete="off"
      />
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
        description="Sign back in on any device with your name + this PIN. Don’t forget it."
      />
      {state.error ? (
        <p className="text-sm text-destructive" aria-live="polite">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create room"}
      </Button>
    </form>
  );
}
