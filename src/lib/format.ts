import type { DateTime } from 'luxon';

import type { MoladInfo } from '@/lib/calendar/molad';

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

/**
 * Localized weekday + clock-time parts of a molad announcement, e.g.
 * { weekday: "Friday", time: "5:03 PM" }. The chalakim stay a plain number the
 * caller interpolates into the translated sentence.
 */
export function formatMoladParts(molad: MoladInfo, locale = 'en'): { weekday: string; time: string } {
  const at = molad.date.set({ hour: molad.hours, minute: molad.minutes }).setLocale(locale);
  return {
    weekday: at.toLocaleString({ weekday: 'long' }),
    time: at.toLocaleString({ hour: 'numeric', minute: '2-digit' }),
  };
}
