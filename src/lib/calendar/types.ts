import type { DateTime } from 'luxon';

export type CalendarMode = 'gregorian' | 'hebrew';

/** Day classification used for calendar-cell coloring (highest precedence wins). */
export type DayCategory =
  | 'yomTov'
  | 'cholHamoed'
  | 'erevYomTov'
  | 'taanis'
  | 'roshChodesh'
  | 'shabbos'
  | 'weekday';

export interface MonthGridCell {
  /** Gregorian date for this cell (always, even in Hebrew mode). */
  date: DateTime;
  /** True when the cell belongs to the active month (false for padding days). */
  inMonth: boolean;
}

export interface MonthGrid {
  cells: MonthGridCell[];
  /** Number of weeks (rows): 4, 5, or 6 depending on the month. */
  weeks: number;
}

export interface DayInfo {
  category: DayCategory;
  /** Formatted significant-day name (Yom Tov / fast / Chol Hamoed), or null. */
  label: string | null;
  /** kosher-zmanim significant-day index, or -1. Used for locale overrides. */
  yomTovIndex: number;
  /** Day of Chanukah (1-8) when applicable, else 0. */
  dayOfChanukah: number;
  isRoshChodesh: boolean;
  isShabbos: boolean;
  /** Weekly parsha name (only set on Shabbos), or null. */
  parsha: string | null;
  /** This week's parsha (the upcoming Shabbos's), readable on any weekday, or null. */
  weekParsha: string | null;
  /** Day of the Omer (1-49), or -1 outside the counting period. */
  omer: number;
  /** True on Shabbos Mevorchim (the Shabbos before Rosh Chodesh). */
  isShabbosMevorchim: boolean;
  /** Hebrew day-of-month number (1-30). */
  hebrewDayOfMonth: number;
  /** Formatted Hebrew month name. */
  hebrewMonth: string;
}
