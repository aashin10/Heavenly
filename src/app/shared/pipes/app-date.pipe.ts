import { Pipe, PipeTransform } from '@angular/core';
import { formatAppDate, formatAppDateTime } from '../utils/date-format.util';

/**
 * Template-side wrappers over the shared date formatters. Prefer these to
 * `| date:'...'` so no template can invent its own pattern.
 */

/** "12 Mar 2026" */
@Pipe({ name: 'appDate', standalone: true })
export class AppDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, fallback = '—'): string {
    return formatAppDate(value, fallback);
  }
}

/** "12 Mar 2026, 2:30 PM" */
@Pipe({ name: 'appDateTime', standalone: true })
export class AppDateTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, fallback = '—'): string {
    return formatAppDateTime(value, fallback);
  }
}
