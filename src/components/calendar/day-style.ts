import type { DayCategory } from '@/lib/calendar';

/**
 * Single source of truth for significant-day colors, shared by the mobile grid
 * dots and the day-panel chips so the same day always reads the same color.
 * `chip` is the soft badge style; `dot` is the solid indicator style.
 */
export type DayTone =
  | 'festival'
  | 'cholHamoed'
  | 'erev'
  | 'fast'
  | 'roshChodesh'
  | 'chanukah'
  | 'minor'
  | 'isruChag'
  | 'shabbat'
  | 'omer'
  | 'mevorchim'
  | 'parsha'
  | 'custom';

export const DAY_TONE: Record<DayTone, { chip: string; dot: string }> = {
  festival: { chip: 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200', dot: 'bg-pink-500' },
  cholHamoed: { chip: 'bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300', dot: 'bg-pink-300' },
  erev: { chip: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300', dot: 'bg-amber-300' },
  fast: { chip: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300', dot: 'bg-slate-400' },
  roshChodesh: { chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300', dot: 'bg-blue-500' },
  chanukah: { chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', dot: 'bg-amber-500' },
  minor: { chip: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300', dot: 'bg-yellow-400' },
  isruChag: { chip: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300', dot: 'bg-gray-400' },
  shabbat: { chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', dot: 'bg-sky-500' },
  omer: { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  mevorchim: { chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', dot: 'bg-violet-500' },
  parsha: { chip: 'bg-muted text-foreground', dot: 'bg-muted-foreground' },
  // Personal dates (birthdays, bar/bat mitzvahs, yahrzeits) — teal, a hue no
  // significant-day category uses, so they read as clearly "yours".
  custom: { chip: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200', dot: 'bg-teal-500' },
};

/** The tone of the day's single most significant marker (used for the grid dot). */
export function significantTone(category: DayCategory, dayOfChanukah: number): DayTone {
  if (dayOfChanukah > 0) return 'chanukah';
  switch (category) {
    case 'yomTov':
      return 'festival';
    case 'cholHamoed':
      return 'cholHamoed';
    case 'erevYomTov':
      return 'erev';
    case 'taanis':
      return 'fast';
    case 'roshChodesh':
      return 'roshChodesh';
    case 'isruChag':
      return 'isruChag';
    default:
      return 'minor'; // a labeled weekday: Purim, Tu BiShvat, Lag BaOmer (when not a Yom Tov), …
  }
}

/**
 * Background tint for a calendar cell. Yom Tov is the only significant-day
 * category whose whole cell is filled (a whisper of the Yom Tov rose under its
 * full-strength chip); Shabbat keeps its subtle base tint.
 */
export function cellBackgroundClass(category: DayCategory, isOffRange: boolean): string {
  if (isOffRange) return 'bg-muted/40';
  if (category === 'yomTov') return 'bg-day-yomtov-cell';
  if (category === 'shabbos') return 'bg-day-shabbos';
  return 'bg-card';
}

/** Colored chip class for the significant-day label, by category. */
export function categoryChipClass(category: DayCategory): string {
  const map: Record<DayCategory, string> = {
    yomTov: 'bg-day-yomtov',
    cholHamoed: 'bg-day-cholhamoed',
    erevYomTov: 'bg-day-erev',
    taanis: 'bg-day-taanis',
    roshChodesh: 'bg-day-roshchodesh',
    shabbos: 'bg-day-shabbos',
    isruChag: 'bg-day-isruchag',
    // A labeled weekday is a minor holiday (Purim, Tu B'Av, Chanukah, …).
    weekday: 'bg-day-holiday',
  };
  return map[category];
}
