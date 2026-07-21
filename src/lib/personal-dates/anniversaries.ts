import { JewishDate } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

import { daysInJewishMonth, isHebrewLeapYear, jewishToLocalDay } from '@/lib/calendar';

import type { AdarBehavior, HebrewDateParts } from './types';

/**
 * Anniversary / yahrzeit arithmetic, transcribed from the algorithm in
 * "Calendrical Calculations" (Reingold & Dershowitz) as implemented by Hebcal.
 * All functions are Hebrew-in / Hebrew-out; conversion to Gregorian happens
 * only at the edges via `jewishToLocalDay` (kosher-zmanim's own `getDate()`
 * carries a foreign Luxon instance that must never touch app DateTimes).
 *
 * kosher-zmanim month numbering: 1=Nisan … 8=Cheshvan, 9=Kislev, 10=Tevet,
 * 11=Shevat, 12=Adar / Adar I, 13=Adar II (leap years only).
 */
const NISAN = 1;
const CHESHVAN = 8;
const KISLEV = 9;
const TEVET = 10;
const SHEVAT = 11;
const ADAR = 12;
const ADAR_II = 13;

const longCheshvan = (year: number): boolean => daysInJewishMonth(year, CHESHVAN) === 30;
const shortKislev = (year: number): boolean => daysInJewishMonth(year, KISLEV) === 29;
const lastMonthOfYear = (year: number): number => (isHebrewLeapYear(year) ? ADAR_II : ADAR);

/** Build a kosher-zmanim JewishDate from parts. The parts must be valid for the year. */
export function toJewishDate(parts: HebrewDateParts): JewishDate {
  const jd = new JewishDate();
  jd.setJewishDate(parts.year, parts.month, parts.day);
  return jd;
}

/** The Gregorian day (app-Luxon, local midnight) a Hebrew date falls on. */
export function hebrewPartsToDay(parts: HebrewDateParts): DateTime {
  return jewishToLocalDay(toJewishDate(parts));
}

/** The Hebrew date a Gregorian day falls on. */
export function partsFromDay(dt: DateTime): HebrewDateParts {
  const jd = new JewishDate(dt);
  return { year: jd.getJewishYear(), month: jd.getJewishMonth(), day: jd.getJewishDayOfMonth() };
}

/**
 * The birthday-style anniversary of `anchor` in Hebrew year `hyear`, or null
 * when `hyear` precedes the anchor. The anchor year itself returns the anchor.
 *
 * Rules (Calendrical Calculations p. 111): born in Adar of a regular year or
 * Adar II of a leap year → the last month of the target year (Adar II in leap
 * years — the halachic bar-mitzvah rule; `adar` = 'adar1' overrides this for
 * plain birthdays of Adar-of-regular-year anchors). Born on the 30th of
 * Cheshvan, Kislev or Adar I → postponed to the first of the following month
 * in years where that 30th does not exist.
 */
export function anniversaryInYear(anchor: HebrewDateParts, hyear: number, adar: AdarBehavior): HebrewDateParts | null {
  if (hyear < anchor.year) return null;
  if (hyear === anchor.year) return { ...anchor };
  const origLeap = isHebrewLeapYear(anchor.year);
  let month = anchor.month;
  let day = anchor.day;
  if ((month === ADAR && !origLeap) || (month === ADAR_II && origLeap)) {
    // An Adar II anchor always follows the last month; the per-entry choice
    // only exists for anchors in the single Adar of a regular year.
    month = !isHebrewLeapYear(hyear) ? ADAR : anchor.month === ADAR_II || adar === 'adar2' ? ADAR_II : ADAR;
  } else if (month === CHESHVAN && day === 30 && !longCheshvan(hyear)) {
    month = KISLEV;
    day = 1;
  } else if (month === KISLEV && day === 30 && shortKislev(hyear)) {
    month = TEVET;
    day = 1;
  } else if (month === ADAR && day === 30 && origLeap && !isHebrewLeapYear(hyear)) {
    month = NISAN;
    day = 1;
  }
  return { year: hyear, month, day };
}

/**
 * The yahrzeit of a death on `anchor` observed in Hebrew year `hyear`, or null
 * when `hyear` is on or before the year of death.
 *
 * Rules (Calendrical Calculations p. 113): a death on 30 Cheshvan / 30 Kislev
 * depends on the *first* anniversary year — if that year lacks the 30th, all
 * later years observe the day before 1 Kislev / 1 Tevet (which is a 29th or a
 * 30th, depending on the target year); otherwise the 30th is kept and advanced
 * to Rosh Chodesh in years where it does not exist. A death in Adar II follows
 * the last month of the year; 30 Adar I falls back to 30 Shevat in non-leap
 * years. A death in Adar of a regular year defaults to Adar I in leap years
 * (Ashkenazi custom, Rema) — `adar` = 'adar2' selects the Sephardi custom.
 */
export function yahrzeitInYear(anchor: HebrewDateParts, hyear: number, adar: AdarBehavior): HebrewDateParts | null {
  if (hyear <= anchor.year) return null;
  const origLeap = isHebrewLeapYear(anchor.year);
  let month = anchor.month;
  let day = anchor.day;
  if (month === CHESHVAN && day === 30 && !longCheshvan(anchor.year + 1)) {
    day = daysInJewishMonth(hyear, CHESHVAN); // day before 1 Kislev
  } else if (month === KISLEV && day === 30 && shortKislev(anchor.year + 1)) {
    day = daysInJewishMonth(hyear, KISLEV); // day before 1 Tevet
  } else if (month === ADAR_II) {
    month = lastMonthOfYear(hyear);
  } else if (month === ADAR && day === 30 && !isHebrewLeapYear(hyear)) {
    // 30 Adar I exists only in leap years; a regular year's Adar has 29 days.
    month = SHEVAT;
    day = 30;
  } else if (month === ADAR && !origLeap && isHebrewLeapYear(hyear) && adar === 'adar2') {
    month = ADAR_II;
  }
  // Advance a kept 30th to Rosh Chodesh when the target month is short.
  if (month === CHESHVAN && day === 30 && !longCheshvan(hyear)) {
    month = KISLEV;
    day = 1;
  } else if (month === KISLEV && day === 30 && shortKislev(hyear)) {
    month = TEVET;
    day = 1;
  }
  return { year: hyear, month, day };
}
