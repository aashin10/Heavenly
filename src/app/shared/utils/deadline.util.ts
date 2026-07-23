/**
 * Deadline / countdown formatting.
 *
 * Every countdown in the app goes through here so expired dates degrade to a
 * sensible label instead of rendering negative counts like "-905 days left".
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days until `date`. Negative once the date has passed. */
export function daysUntil(date: Date | string): number {
  const target = date instanceof Date ? date : new Date(date);
  return Math.ceil((target.getTime() - Date.now()) / MS_PER_DAY);
}

/** True once the date has passed. */
export function isPast(date: Date | string): boolean {
  const target = date instanceof Date ? date : new Date(date);
  return target.getTime() <= Date.now();
}

/** Countdown for a bidding/closing deadline: "Closed", "Last day", "3 days left". */
export function deadlineLabel(date: Date | string): string {
  const days = daysUntil(date);
  if (days < 0) return 'Closed';
  if (days === 0) return 'Last day';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

/** Countdown for something that lapses: "Expired", "Expires today", "Expires in 3 days". */
export function expiryLabel(date: Date | string): string {
  const days = daysUntil(date);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

/** Whether a deadline should be visually flagged as urgent (and not already past). */
export function isUrgent(date: Date | string, withinDays = 3): boolean {
  const days = daysUntil(date);
  return days >= 0 && days <= withinDays;
}
