"use client";

// Server HTML gets an executable script (runs during parsing, before paint);
// client renders get an inert text/plain block — inline scripts never execute
// when React renders them client-side, and the inert type silences React 19's
// dev warning. Pattern from Next's preventing-flash-before-hydration guide.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
