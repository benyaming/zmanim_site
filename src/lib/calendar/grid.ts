import { JewishDate } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

import { jewishToLocalDay } from './jewish-date';
import type { CalendarMode, MonthGrid, MonthGridCell } from './types';

/** Sunday-first weekday index: Luxon weekday is Mon=1..Sun=7, we want Sun=0..Sat=6. */
function sundayFirstIndex(date: DateTime): number {
  return date.weekday % 7;
}

/** Gregorian DateTime of the first day of the active month (Gregorian or Hebrew). */
export function firstDayOfMonth(date: DateTime, mode: CalendarMode): DateTime {
  if (mode === 'hebrew') {
    const jd = new JewishDate(date);
    jd.setJewishDayOfMonth(1);
    // Rebuild in the app's Luxon (kosher-zmanim ships its own copy) so the grid's
    // cells compare cleanly with "today"/the selected day via DateTime#hasSame.
    return jewishToLocalDay(jd);
  }
  return date.set({ day: 1 }).startOf('day');
}

/** Number of days in the active month. */
export function daysInActiveMonth(date: DateTime, mode: CalendarMode): number {
  if (mode === 'hebrew') {
    return new JewishDate(date).getDaysInJewishMonth();
  }
  // luxon's daysInMonth is always defined for a valid DateTime.
  return date.daysInMonth as number;
}

/**
 * Build a Sunday-first month grid with a DYNAMIC number of weeks (4/5/6).
 *
 * The legacy app hardcoded a 35-cell (5-week) grid and computed
 * `appendDays = 35 - daysInMonth - prependDays`, which went NEGATIVE for any
 * month spanning 6 weeks and dropped/corrupted days. This computes the row
 * count from the actual layout so every day is always shown.
 */
export function buildMonthGrid(date: DateTime, mode: CalendarMode): MonthGrid {
  const first = firstDayOfMonth(date, mode);
  const days = daysInActiveMonth(date, mode);
  const prepend = sundayFirstIndex(first);

  const totalCells = Math.ceil((prepend + days) / 7) * 7;
  const start = first.minus({ days: prepend });

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    cells.push({
      date: start.plus({ days: i }),
      inMonth: i >= prepend && i < prepend + days,
    });
  }

  return { cells, weeks: totalCells / 7 };
}
