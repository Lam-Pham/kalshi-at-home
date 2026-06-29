"use client";

// A submit button for a (bound) server action that asks for confirmation first.
// Used for the admin page's destructive actions. The native confirm() is fine in
// real app UX — it only blocks the browser-automation tools, not users.
export function ConfirmButton({
  action,
  label,
  confirm,
  className,
}: {
  action: () => void | Promise<void>;
  label: string;
  confirm: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
      className="contents"
    >
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
