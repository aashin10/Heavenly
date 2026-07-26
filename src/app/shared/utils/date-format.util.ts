import { formatDate } from '@angular/common';

/**
 * The app's two date formats. Everything that renders a date goes through here
 * so the formats can't drift apart again.
 *
 * Before this existed there were nine implementations in play — Angular `date`
 * pipes with four different patterns, six hand-rolled `toLocaleDateString`
 * calls (one still on `en-US`, giving "March 12, 2026" next to "12 Mar 2026"),
 * and one bare `toLocaleDateString()` falling back to the browser locale.
 */
export const DATE_FORMAT = 'd MMM y'; // 12 Mar 2026
export const DATE_TIME_FORMAT = 'd MMM y, h:mm a'; // 12 Mar 2026, 2:30 PM

/**
 * Locale is pinned rather than injected. Only `en-US` locale data ships with
 * Angular by default, and these explicit patterns render identically under it —
 * so pinning avoids a "Missing locale data" crash without changing output.
 */
const LOCALE = 'en-US';

function format(value: string | Date | null | undefined, pattern: string, fallback: string): string {
  if (!value) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return formatDate(date, pattern, LOCALE);
}

/** "12 Mar 2026" — for plain dates. */
export function formatAppDate(value: string | Date | null | undefined, fallback = '—'): string {
  return format(value, DATE_FORMAT, fallback);
}

/** "12 Mar 2026, 2:30 PM" — for deadlines and timestamps, never with seconds. */
export function formatAppDateTime(value: string | Date | null | undefined, fallback = '—'): string {
  return format(value, DATE_TIME_FORMAT, fallback);
}
