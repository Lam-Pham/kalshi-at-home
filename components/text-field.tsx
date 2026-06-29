import { cn } from "@/lib/utils";

// Hand-rolled native label + input — we skip shadcn's input/label here on
// purpose (the generator was unusable in this env) but keep the same tokens
// so it reads like the rest of base-nova.
export function TextField({
  label,
  description,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: string; description?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        className={cn(
          "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors",
          "placeholder:text-muted-foreground/60",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
        {...props}
      />
      {description ? (
        <span className="text-[11px] leading-snug text-muted-foreground/70">{description}</span>
      ) : null}
    </label>
  );
}
