import { JewishDate } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

import { jewishToLocalDay } from './jewish-date';
import type { CalendarMode } from './types';

/**
 * A stable in-month anchor (the 15th) for the month that contains `date`, used as
 * the viewed-month pointer so navigation can't overflow a short month.
 *
 * Crucially this is **mode-aware**: in Hebrew mode it anchors on the 15th of the
 * *Hebrew* month, not the Gregorian 15th. The Gregorian 15th usually falls in the
 * *next* Hebrew month (Hebrew months start mid-Gregorian-month), so using it as a
 * Hebrew-grid anchor renders the wrong month and hides "today". Always derive the
 * anchor through this helper when setting `monthDate`.
 */
export function monthAnchor(date: DateTime, mode: CalendarMode): DateTime {
  if (mode === 'hebrew') {
    const jd = new JewishDate(date);
    jd.setJewishDayOfMonth(15);
    return jewishToLocalDay(jd);
  }
  return date.set({ day: 15 }).startOf('day');
}

/**
 * Move the viewed month by one step. The returned DateTime is anchored on the
 * 15th of the target month so it can never overflow a short month (the source
 * of a class of off-by-one calendar bugs).
 *
 * The legacy `handlePrev` ran the Hebrew branch and then FELL THROUGH to the
 * Gregorian branch (missing return), so Hebrew navigation was broken. Here the
 * two modes are cleanly separated and each returns a correctly anchored date.
 */
export function shiftMonth(date: DateTime, mode: CalendarMode, direction: 1 | -1): DateTime {
  if (mode === 'hebrew') {
    return shiftHebrewMonth(date, direction);
  }
  return date.set({ day: 15 }).plus({ months: direction }).startOf('day');
}

export function prevMonth(date: DateTime, mode: CalendarMode): DateTime {
  return shiftMonth(date, mode, -1);
}

export function nextMonth(date: DateTime, mode: CalendarMode): DateTime {
  return shiftMonth(date, mode, 1);
}

/** Move the viewed month by a year (12/13 Hebrew months), anchored on the 15th. */
export function shiftYear(date: DateTime, mode: CalendarMode, direction: 1 | -1): DateTime {
  if (mode === 'hebrew') {
    return shiftHebrewYear(date, direction);
  }
  return date.set({ day: 15 }).plus({ years: direction }).startOf('day');
}

export function prevYear(date: DateTime, mode: CalendarMode): DateTime {
  return shiftYear(date, mode, -1);
}

export function nextYear(date: DateTime, mode: CalendarMode): DateTime {
  return shiftYear(date, mode, 1);
}

/** Metonic-cycle leap-year rule: 7 leap years in each 19-year cycle. */
function isHebrewLeapYear(year: number): boolean {
  return (year * 7 + 1) % 19 < 7;
}

function shiftHebrewYear(date: DateTime, direction: 1 | -1): DateTime {
  const jd = new JewishDate(date);
  const targetYear = jd.getJewishYear() + direction;
  let month = jd.getJewishMonth();
  // Adar II (month 13) only exists in leap years; clamp to Adar (12) otherwise.
  if (month === 13 && !isHebrewLeapYear(targetYear)) month = 12;
  jd.setJewishDate(targetYear, month, 15);
  return jewishToLocalDay(jd);
}

/**
 * Hebrew month navigation via Gregorian-day arithmetic. Anchor on day 1 of the
 * current Hebrew month, step to an adjacent month using that month's actual
 * length, then re-anchor on the 15th. Robust across leap years (Adar I/II) and
 * variable month lengths.
 */
function shiftHebrewMonth(date: DateTime, direction: 1 | -1): DateTime {
  const jd = new JewishDate(date);
  jd.setJewishDayOfMonth(1);
  const firstGregorian = jd.getDate();

  const target =
    direction === 1
      ? firstGregorian.plus({ days: jd.getDaysInJewishMonth() }) // day 1 of next month
      : firstGregorian.minus({ days: 1 }); // last day of previous month

  const anchored = new JewishDate(target);
  anchored.setJewishDayOfMonth(15);
  return jewishToLocalDay(anchored);
}
