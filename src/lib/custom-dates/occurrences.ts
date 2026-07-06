import { JewishDate } from 'kosher-zmanim';
import type { DateTime } from 'luxon';

import { daysInJewishMonth, isHebrewLeapYear, jewishToLocalDay } from '@/lib/calendar';

import type { AdarBehavior, CustomDate, CustomDateOccurrence, HebrewDateParts } from './types';

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

/** The entry's Adar choice with kind defaults applied. */
export function effectiveAdar(entry: CustomDate): AdarBehavior {
  if (entry.kind === 'barMitzvah' || entry.kind === 'batMitzvah') return 'adar2';
  return entry.adarBehavior ?? (entry.kind === 'yahrzeit' ? 'adar1' : 'adar2');
}

/** The Hebrew year a bar (13) / bat (12) mitzvah falls in. */
export function barMitzvahYear(entry: CustomDate): number {
  return entry.hebrew.year + (entry.kind === 'batMitzvah' ? 12 : 13);
}

/**
 * The entry's observance in `hyear`, or null when it has none there: birthdays
 * recur from the birth year on (the birth date itself is `number` 0), yahrzeits
 * from the year after death, bar/bat mitzvah only in its single year.
 */
export function occurrenceInYear(entry: CustomDate, hyear: number): CustomDateOccurrence | null {
  const number = hyear - entry.hebrew.year;
  switch (entry.kind) {
    case 'birthday': {
      const hebrew = anniversaryInYear(entry.hebrew, hyear, effectiveAdar(entry));
      return hebrew ? { entry, hebrew, number } : null;
    }
    case 'barMitzvah':
    case 'batMitzvah': {
      if (hyear !== barMitzvahYear(entry)) return null;
      const hebrew = anniversaryInYear(entry.hebrew, hyear, 'adar2');
      return hebrew ? { entry, hebrew, number } : null;
    }
    case 'yahrzeit': {
      const hebrew = yahrzeitInYear(entry.hebrew, hyear, effectiveAdar(entry));
      return hebrew ? { entry, hebrew, number } : null;
    }
  }
}

/** All entries observed on the given Gregorian day (pure Hebrew-date comparison). */
export function occurrencesOn(date: DateTime, entries: readonly CustomDate[]): CustomDateOccurrence[] {
  if (entries.length === 0) return [];
  const jd = new JewishDate(date);
  const hyear = jd.getJewishYear();
  const month = jd.getJewishMonth();
  const day = jd.getJewishDayOfMonth();
  const out: CustomDateOccurrence[] = [];
  for (const entry of entries) {
    const occ = occurrenceInYear(entry, hyear);
    if (occ && occ.hebrew.month === month && occ.hebrew.day === day) out.push(occ);
  }
  return out;
}

export interface NextOccurrence {
  hebrew: HebrewDateParts;
  date: DateTime;
  number: number;
}

/**
 * The entry's next observance on or after `today`. Bar/bat mitzvah returns its
 * one fixed date even when it is already past (callers show "was on …").
 */
export function nextOccurrence(entry: CustomDate, today: DateTime): NextOccurrence | null {
  const start = today.startOf('day');
  if (entry.kind === 'barMitzvah' || entry.kind === 'batMitzvah') {
    const occ = occurrenceInYear(entry, barMitzvahYear(entry));
    return occ ? { hebrew: occ.hebrew, date: hebrewPartsToDay(occ.hebrew), number: occ.number } : null;
  }
  const currentYear = new JewishDate(start).getJewishYear();
  const firstYear = entry.hebrew.year + (entry.kind === 'yahrzeit' ? 1 : 0);
  const from = Math.max(currentYear, firstYear);
  // This year's observance if it hasn't passed, otherwise next year's.
  for (let hyear = from; hyear <= from + 1; hyear++) {
    const occ = occurrenceInYear(entry, hyear);
    if (!occ) continue;
    const date = hebrewPartsToDay(occ.hebrew);
    if (date >= start) return { hebrew: occ.hebrew, date, number: occ.number };
  }
  return null;
}

/**
 * A stable serialization of everything that affects rendering, used as the
 * calendar grid's cache identity (the array's object identity is not). JSON,
 * not a delimiter join: `label` is free user text and could otherwise contain
 * the separators and forge a different list's fingerprint, staling the cache.
 */
export function customDatesFingerprint(entries: readonly CustomDate[]): string {
  return JSON.stringify(
    entries.map((e) => [e.id, e.kind, e.hebrew.year, e.hebrew.month, e.hebrew.day, e.adarBehavior ?? '', e.label]),
  );
}
