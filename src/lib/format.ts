import type { DateTime } from 'luxon';

import type { MoladInfo } from '@/lib/calendar/molad';

/** Format a zman time as a short local time, e.g. "5:42 AM". Returns a dash when undefined. */
export function formatTime(time: DateTime | null, locale = 'en'): string {
  if (!time) return '—';
  return time.setLocale(locale).toLocaleString({ hour: 'numeric', minute: '2-digit' });
}

// Whether the locale's clock is 12-hour, resolved once per locale.
const HOUR12 = new Map<string, boolean>();

/**
 * Format a zman time bare — the locale's clock without its day-period suffix:
 * "4:53" where formatTime gives "4:53 PM", and "16:53" untouched for 24-hour
 * locales. This is how every printed luach sets its times (the column and the
 * hour of day disambiguate), and on a sheet of thirty time columns the suffix
 * would cost a third of every column's width.
 */
export function formatTimePlain(time: DateTime | null, locale = 'en'): string {
  if (!time) return '—';
  let hour12 = HOUR12.get(locale);
  if (hour12 === undefined) {
    hour12 = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;
    HOUR12.set(locale, hour12);
  }
  return time.toFormat(hour12 ? 'h:mm' : 'H:mm');
}

/**
 * Format a length of time in ms as h:mm:ss (e.g. a shaah zmanis of "1:02:35",
 * rounded to the whole second). Returns a dash when undefined.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
