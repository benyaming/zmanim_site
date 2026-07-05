import { HebrewDateFormatter, JewishCalendar } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

import { getMolad } from './molad';
import { RU_MONTHS, RU_MONTHS_GENITIVE } from './months-ru';
import { RU_PARSHIYOS } from './parshiyos-ru';
import type { DayCategory, DayInfo } from './types';

/**
 * A reusable formatter so callers can avoid re-instantiating per cell (42×/render).
 * For `he` it formats Yom Tov / parsha / month names in Hebrew script; for `ru` it
 * installs the Russian parsha and month transliterations (kosher-zmanim has no
 * Russian dataset, so Russian Yom Tov names are overridden separately in
 * `holidays-ru.ts`).
 */
export function createHebrewFormatter(locale = 'en'): HebrewDateFormatter {
  const formatter = new HebrewDateFormatter();
  if (locale === 'he') {
    formatter.setHebrewFormat(true);
  } else if (locale === 'ru') {
    formatter.setTransliteratedParshiosList(RU_PARSHIYOS);
    formatter.setTransliteratedMonthList(RU_MONTHS);
  }
  return formatter;
}

/**
 * Russian renders the day+month label in the genitive ("16 Таммуза"), so we can't
 * reuse the nominative formatter installed for the header. A dedicated formatter
 * carries the genitive list yet still delegates leap-year month resolution
 * (Adar I/II) to kosher-zmanim. Built lazily and cached (getDayInfo runs 42×/render).
 */
let ruGenitiveFormatter: HebrewDateFormatter | undefined;

/** Hebrew month name for the day+month label — genitive in Russian, else default. */
function hebrewMonthLabel(jc: JewishCalendar, fmt: HebrewDateFormatter, locale: string): string {
  if (locale !== 'ru') return fmt.formatMonth(jc);
  if (!ruGenitiveFormatter) {
    ruGenitiveFormatter = new HebrewDateFormatter();
    ruGenitiveFormatter.setTransliteratedMonthList(RU_MONTHS_GENITIVE);
  }
  return ruGenitiveFormatter.formatMonth(jc);
}

/**
 * Classify a day for coloring. Precedence matters because `isYomTov()` is broad
 * (it also reports true for Chol Hamoed, Chanukah and Yom Kippur), so the more
 * specific categories must be checked first.
 */
function classify(jc: JewishCalendar, isShabbos: boolean): DayCategory {
  // Chanukah is a minor festival (work permitted) but kosher-zmanim's isYomTov()
  // reports it as a Yom Tov — guard it first so it gets the neutral minor-day
  // treatment (like Purim / Tu BiShvat) rather than the Yom Tov color.
  if (jc.isChanukah()) return 'weekday';
  if (jc.isCholHamoed()) return 'cholHamoed';
  if (jc.isErevYomTov()) return 'erevYomTov';
  // Only work-prohibited days count as Yom Tov for coloring. The broad
  // isYomTov() also reports minor holidays (Purim, Pesach Sheni, Tu B'Av, …),
  // which must fall through to the labeled-weekday (minor holiday) tint.
  if (jc.isYomTovAssurBemelacha()) return 'yomTov';
  if (jc.isTaanis()) return 'taanis';
  if (jc.isRoshChodesh()) return 'roshChodesh';
  if (isShabbos) return 'shabbos';
  // Isru Chag is quieter than the other labeled weekdays (Purim & co.) — it
  // gets a neutral grey rather than the holiday tint.
  if (jc.getYomTovIndex() === JewishCalendar.ISRU_CHAG) return 'isruChag';
  return 'weekday';
}

/** The coming Saturday (or the same day, if it already is Shabbos). */
function upcomingShabbos(date: DateTime): DateTime {
  let d = date;
  while (d.weekday !== 6) d = d.plus({ days: 1 }); // Luxon: Saturday === 6
  return d;
}

/**
 * This week's parsha — the one read on the upcoming Shabbos — so it's meaningful
 * on weekdays too. Returns null when that Shabbos is a Yom Tov with no parsha.
 * (kosher-zmanim's own getUpcomingParsha() is broken in this version, so we walk
 * to the coming Shabbos ourselves.)
 */
function getWeekParsha(date: DateTime, fmt: HebrewDateFormatter, inIsrael: boolean): string | null {
  const jc = new JewishCalendar(upcomingShabbos(date));
  jc.setInIsrael(inIsrael); // diaspora can diverge from Israel on some weeks
  return fmt.formatParsha(jc) || null;
}

/** Is the day Erev Pesach (14 Nissan) — when the chametz deadlines apply? */
export function isErevPesach(date: DateTime): boolean {
  return new JewishCalendar(date).getYomTovIndex() === JewishCalendar.EREV_PESACH;
}

export function getDayInfo(date: DateTime, formatter?: HebrewDateFormatter, locale = 'en', inIsrael = false): DayInfo {
  const fmt = formatter ?? createHebrewFormatter(locale);
  const jc = new JewishCalendar(date);
  jc.setInIsrael(inIsrael); // Israel vs. diaspora luach (parsha schedule, 1- vs 2-day Yom Tov)
  // Israeli national days (Yom HaShoah, HaZikaron, HaAtzmaut, Yerushalayim) —
  // shown everywhere, like mainstream luchos (Hebcal & co.) do.
  jc.setUseModernHolidays(true);
  const isShabbos = date.weekday === 6; // Luxon: Saturday === 6

  const yomTov = fmt.formatYomTov(jc);
  const parsha = fmt.formatParsha(jc);
  const specialShabbos = fmt.formatSpecialParsha(jc); // Shekalim…Hachodesh, Shuva, Shira, Hagadol, Chazon, Nachamu
  const isRoshChodesh = jc.isRoshChodesh();
  const isShabbosMevorchim = jc.isShabbosMevorchim();

  return {
    category: classify(jc, isShabbos),
    label: yomTov || null,
    yomTovIndex: jc.getYomTovIndex(),
    dayOfChanukah: jc.isChanukah() ? jc.getDayOfChanukah() : 0,
    isRoshChodesh,
    isShabbos,
    parsha: parsha || null,
    weekParsha: getWeekParsha(date, fmt, inIsrael),
    specialShabbos: specialShabbos || null,
    omer: jc.getDayOfOmer(),
    isShabbosMevorchim,
    // The molad is announced on Shabbat Mevorchim and belongs with the Rosh
    // Chodesh info; on a 30th (first RC day) getMolad already reads the
    // incoming month.
    molad: isRoshChodesh || isShabbosMevorchim ? getMolad(date) : null,
    hebrewDayOfMonth: jc.getJewishDayOfMonth(),
    hebrewMonth: hebrewMonthLabel(jc, fmt, locale),
  };
}
