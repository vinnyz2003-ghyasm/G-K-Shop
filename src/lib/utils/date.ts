/**
 * Every date in this app is anchored to Asia/Kolkata, never the
 * device's local timezone or the server's UTC clock. A sale rung up
 * at 12:30am on a phone set to UTC should still land on *today in
 * Lucknow*, not yesterday — this is what the schema's
 * `(now() at time zone 'Asia/Kolkata')::date` defaults mirror.
 */
const IST_TIME_ZONE = "Asia/Kolkata";

/** Returns today's date in IST as 'YYYY-MM-DD' — safe to store directly in a `date` column. */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // en-CA happens to format as YYYY-MM-DD
}

/**
 * Strict YYYY-MM-DD shape + real-calendar-date check (catches things
 * like 2026-02-30). Deliberately never goes through `new Date("...T00:00:00")`
 * with no offset — that constructor reads the string as *local browser
 * time*, and converting it back to compare shifts the date by a day for
 * any timezone ahead of UTC (i.e. every device set to IST). Everything
 * here stays anchored to UTC components explicitly, so the result is the
 * same no matter what timezone the shopkeeper's phone is set to.
 */
export function isValidISODate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;

  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Rejects dates after "today" in IST — mirrors the DB's CHECK constraints, so bad input is caught client-side too. */
export function isFutureIST(value: string): boolean {
  return value > todayIST();
}

/** Human-friendly display, e.g. "27 Jun 2026". Always renders in IST regardless of viewer's device timezone. */
export function formatDateDisplay(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00+05:30`));
}
