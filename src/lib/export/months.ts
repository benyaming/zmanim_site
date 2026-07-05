import { JewishDate } from 'kosher-zmanim';
import { DateTime, Info as LuxonInfo } from 'luxon';

import {
  type CalendarMode,
  createHebrewFormatter,
  jewishToLocalDay,
  monthAnchor,
  nextMonth,
} from '@/lib/calendar';

/** Hard cap on grid-export size — one PDF page per month. */
export const MAX_GRID_MONTHS = 24;

/**
 * Month anchors (the 15th, see `monthAnchor`) for every month from `start` to
 * `end` inclusive, in the given calendar mode. Returns at most
 * MAX_GRID_MONTHS + 1 entries so callers can distinguish "at the cap" from
 * "over the cap" without ever looping a runaway range.
 */
export function monthsInRange(start: DateTime, end: DateTime, mode: CalendarMode): DateTime[] {
  const endAnchor = monthAnchor(end, mode);
  const months: DateTime[] = [];
  let cur = monthAnchor(start, mode);
  while (cur.toMillis() <= endAnchor.toMillis() && months.length <= MAX_GRID_MONTHS) {
    months.push(cur);
    cur = nextMonth(cur, mode);
  }
  return months;
}

/** "July 2026" / "Tammuz 5786" — the month heading, matching the app header. */
export function monthTitle(monthDate: DateTime, mode: CalendarMode, locale: string): string {
  if (mode === 'hebrew') {
    const jd = new JewishDate(monthDate);
    return `${createHebrewFormatter(locale).formatMonth(jd)} ${jd.getJewishYear()}`;
  }
  return monthDate.setLocale(locale).toLocaleString({ month: 'long', year: 'numeric' });
}

/**
 * The viewed month expressed in the other calendar system (the app header's
 * secondary line): the Hebrew month(s) a civil month spans, or vice versa.
 */
export function alternateMonthsTitle(monthDate: DateTime, mode: CalendarMode, locale: string): string {
  if (mode === 'hebrew') {
    const jd = new JewishDate(monthDate);
    jd.setJewishDayOfMonth(1);
    const start = jewishToLocalDay(jd).setLocale(locale);
    const end = start.plus({ days: jd.getDaysInJewishMonth() - 1 });
    if (start.month === end.month) return start.toLocaleString({ month: 'long', year: 'numeric' });
    const endLabel = end.toLocaleString({ month: 'long', year: 'numeric' });
    if (start.year === end.year) return `${start.toLocaleString({ month: 'long' })} – ${endLabel}`;
    return `${start.toLocaleString({ month: 'long', year: 'numeric' })} – ${endLabel}`;
  }

  const fmt = createHebrewFormatter(locale);
  const start = new JewishDate(monthDate.startOf('month'));
  const end = new JewishDate(monthDate.endOf('month').startOf('day'));
  if (start.getJewishMonth() === end.getJewishMonth()) return `${fmt.formatMonth(start)} ${start.getJewishYear()}`;
  if (start.getJewishYear() === end.getJewishYear()) {
    return `${fmt.formatMonth(start)} – ${fmt.formatMonth(end)} ${end.getJewishYear()}`;
  }
  return `${fmt.formatMonth(start)} ${start.getJewishYear()} – ${fmt.formatMonth(end)} ${end.getJewishYear()}`;
}

/** Sunday-first localized short weekday names (the grid's column headers). */
export function weekdayHeaders(locale: string): string[] {
  const names = LuxonInfo.weekdays('short', { locale }); // Mon..Sun
  return [names[6], ...names.slice(0, 6)];
}

/** Metonic-cycle rule: 7 leap years in each 19-year cycle. */
export function isHebrewLeapYear(year: number): boolean {
  return (year * 7 + 1) % 19 < 7;
}

/**
 * The months of a Hebrew year in chronological (Tishrei-first) order, with
 * localized names. kosher-zmanim numbers months Nissan=1…Adar=12/Adar II=13;
 * month 13 only exists in leap years (where 12 formats as "Adar I").
 */
export function hebrewMonthsOfYear(year: number, locale: string): { month: number; label: string }[] {
  const fmt = createHebrewFormatter(locale);
  const order = isHebrewLeapYear(year)
    ? [7, 8, 9, 10, 11, 12, 13, 1, 2, 3, 4, 5, 6]
    : [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
  return order.map((month) => {
    const jd = new JewishDate();
    jd.setJewishDate(year, month, 1);
    return { month, label: fmt.formatMonth(jd) };
  });
}

/** Month anchor (15th) of a Hebrew year+month, clamping Adar II in non-leap years. */
export function hebrewMonthAnchor(year: number, month: number): DateTime {
  const jd = new JewishDate();
  jd.setJewishDate(year, month === 13 && !isHebrewLeapYear(year) ? 12 : month, 15);
  return jewishToLocalDay(jd);
}
