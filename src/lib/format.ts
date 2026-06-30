import type { DateTime } from 'luxon';

/** Format a zman time as a short local time, e.g. "5:42 AM". Returns a dash when undefined. */
export function formatTime(time: DateTime | null, locale = 'en'): string {
  if (!time) return '—';
  return time.setLocale(locale).toLocaleString({ hour: 'numeric', minute: '2-digit' });
}

/** Format a zman time including seconds, e.g. "5:42:30 AM". */
export function formatTimeWithSeconds(time: DateTime | null, locale = 'en'): string {
  if (!time) return '—';
  return time.setLocale(locale).toLocaleString({ hour: 'numeric', minute: '2-digit', second: '2-digit' });
}
