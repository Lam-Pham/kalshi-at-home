// Display formatters shared across the room UI.

/** Dollars, e.g. 12.5 → "$12.50". */
export const usd = (n: number): string =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** A yes-probability in [0,1] as Kalshi-style cents, e.g. 0.29 → "29¢". */
export const cents = (p: number): string => `${Math.round(p * 100)}¢`;

/** A yes-probability in [0,1] as a percent, e.g. 0.29 → "29%". */
export const pct = (p: number): string => `${Math.round(p * 100)}%`;
