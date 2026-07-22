/**
 * Formats a number as Indian Rupees with Indian digit grouping
 * (1,40,800 — not 140,800). `Intl.NumberFormat("en-IN", ...)` does
 * this natively, so there's no manual regex grouping to maintain.
 */
export function formatINR(amount: number, opts: { decimals?: boolean } = {}): string {
  const { decimals = false } = opts;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(amount);
}

/** Same grouping, no ₹ symbol — for compact table cells. */
export function formatNumberIN(amount: number): string {
  return new Intl.NumberFormat("en-IN").format(amount);
}

/** Net profit gets a sign-aware color class; loss should never look like a KPI win. */
export function profitColorClass(amount: number): string {
  if (amount > 0) return "text-primary";       // emerald
  if (amount < 0) return "text-destructive";   // red
  return "text-muted-foreground";
}
