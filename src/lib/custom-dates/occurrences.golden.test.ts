import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  anniversaryInYear,
  customDatesFingerprint,
  hebrewPartsToDay,
  nextOccurrence,
  occurrenceInYear,
  occurrencesOn,
  yahrzeitInYear,
} from './occurrences';
import type { CustomDate, CustomDateKind, HebrewDateParts } from './types';

/**
 * Golden cases pinned against the Hebcal reference implementation of the
 * "Calendrical Calculations" anniversary algorithms (`@hebcal/hdate`
 * anniversary.js — GPL, used strictly as an offline oracle, never imported).
 * Every row's Hebrew result AND Gregorian day were derived from the oracle.
 *
 * Months: 1=Nisan … 8=Cheshvan, 9=Kislev, 10=Tevet, 11=Shevat, 12=Adar/Adar I,
 * 13=Adar II.
 */

const d = (year: number, month: number, day: number): HebrewDateParts => ({ year, month, day });

function entry(kind: CustomDateKind, hebrew: HebrewDateParts, adarBehavior?: 'adar1' | 'adar2'): CustomDate {
  return { id: `${kind}-${hebrew.year}-${hebrew.month}-${hebrew.day}`, kind, label: 'Test', hebrew, adarBehavior };
}

function expectHebrewAndGregorian(actual: HebrewDateParts | null, expected: HebrewDateParts, iso: string) {
  expect(actual).toEqual(expected);
  expect(hebrewPartsToDay(expected).toISODate()).toBe(iso);
}

describe('yahrzeitInYear', () => {
  it('returns null on or before the year of death', () => {
    expect(yahrzeitInYear(d(5787, 8, 30), 5787, 'adar1')).toBeNull();
    expect(yahrzeitInYear(d(5787, 8, 30), 5780, 'adar1')).toBeNull();
  });

  it('30 Cheshvan with a long first-anniversary year keeps the 30th and advances to 1 Kislev in short years', () => {
    // Death 30 Cheshvan 5787; 5788 has a long Cheshvan.
    expectHebrewAndGregorian(yahrzeitInYear(d(5787, 8, 30), 5788, 'adar1'), d(5788, 8, 30), '2027-11-30');
    expectHebrewAndGregorian(yahrzeitInYear(d(5787, 8, 30), 5789, 'adar1'), d(5789, 9, 1), '2028-11-19');
    expectHebrewAndGregorian(yahrzeitInYear(d(5787, 8, 30), 5791, 'adar1'), d(5791, 8, 30), '2030-11-26');
  });

  it('30 Cheshvan with a short first-anniversary year observes the day before 1 Kislev — 29th OR 30th', () => {
    // Death 30 Cheshvan 5780; 5781 has a short Cheshvan.
    expectHebrewAndGregorian(yahrzeitInYear(d(5780, 8, 30), 5781, 'adar1'), d(5781, 8, 29), '2020-11-16');
    // A later long-Cheshvan year observes the 30th (the branch is NOT "29 in all years").
    expectHebrewAndGregorian(yahrzeitInYear(d(5780, 8, 30), 5783, 'adar1'), d(5783, 8, 30), '2022-11-24');
    expectHebrewAndGregorian(yahrzeitInYear(d(5780, 8, 30), 5784, 'adar1'), d(5784, 8, 29), '2023-11-13');
  });

  it('30 Kislev follows the same first-anniversary rule with 1 Tevet', () => {
    // Death 30 Kislev 5783; 5784 has a short Kislev.
    expectHebrewAndGregorian(yahrzeitInYear(d(5783, 9, 30), 5784, 'adar1'), d(5784, 9, 29), '2023-12-12');
    expectHebrewAndGregorian(yahrzeitInYear(d(5783, 9, 30), 5785, 'adar1'), d(5785, 9, 30), '2024-12-31');
    // Death 30 Kislev 5786; 5787 has a long Kislev — kept 30th advances in short years.
    expectHebrewAndGregorian(yahrzeitInYear(d(5786, 9, 30), 5787, 'adar1'), d(5787, 9, 30), '2026-12-10');
    expectHebrewAndGregorian(yahrzeitInYear(d(5786, 9, 30), 5790, 'adar1'), d(5790, 10, 1), '2029-12-07');
  });

  it('30 Adar I falls back to 30 Shevat in non-leap years', () => {
    expectHebrewAndGregorian(yahrzeitInYear(d(5774, 12, 30), 5780, 'adar1'), d(5780, 11, 30), '2020-02-25');
    expectHebrewAndGregorian(yahrzeitInYear(d(5774, 12, 30), 5784, 'adar1'), d(5784, 12, 30), '2024-03-10');
  });

  it('Adar of a regular year observes Adar I by default and Adar II on the Sephardi setting', () => {
    expectHebrewAndGregorian(yahrzeitInYear(d(5783, 12, 14), 5784, 'adar1'), d(5784, 12, 14), '2024-02-23');
    expectHebrewAndGregorian(yahrzeitInYear(d(5783, 12, 14), 5784, 'adar2'), d(5784, 13, 14), '2024-03-24');
    // Non-leap target: single Adar either way.
    expectHebrewAndGregorian(yahrzeitInYear(d(5783, 12, 14), 5785, 'adar1'), d(5785, 12, 14), '2025-03-14');
    expect(yahrzeitInYear(d(5783, 12, 14), 5785, 'adar2')).toEqual(d(5785, 12, 14));
  });

  it('Adar II follows the last month of the target year', () => {
    expectHebrewAndGregorian(yahrzeitInYear(d(5782, 13, 10), 5783, 'adar1'), d(5783, 12, 10), '2023-03-03');
    expectHebrewAndGregorian(yahrzeitInYear(d(5782, 13, 10), 5784, 'adar1'), d(5784, 13, 10), '2024-03-20');
  });
});

describe('anniversaryInYear', () => {
  it('returns null before the anchor year and the anchor itself in its own year', () => {
    expect(anniversaryInYear(d(5783, 12, 14), 5782, 'adar2')).toBeNull();
    expect(anniversaryInYear(d(5783, 12, 14), 5783, 'adar2')).toEqual(d(5783, 12, 14));
  });

  it('30 Adar I moves to 1 Nisan in non-leap years', () => {
    expectHebrewAndGregorian(anniversaryInYear(d(5774, 12, 30), 5780, 'adar2'), d(5780, 1, 1), '2020-03-26');
    expectHebrewAndGregorian(anniversaryInYear(d(5774, 12, 30), 5784, 'adar2'), d(5784, 12, 30), '2024-03-10');
  });

  it('30 Cheshvan / 30 Kislev move to Rosh Chodesh in years missing the 30th', () => {
    expectHebrewAndGregorian(anniversaryInYear(d(5787, 8, 30), 5789, 'adar2'), d(5789, 9, 1), '2028-11-19');
    expectHebrewAndGregorian(anniversaryInYear(d(5787, 8, 30), 5788, 'adar2'), d(5788, 8, 30), '2027-11-30');
    expectHebrewAndGregorian(anniversaryInYear(d(5783, 9, 30), 5784, 'adar2'), d(5784, 10, 1), '2023-12-13');
    expectHebrewAndGregorian(anniversaryInYear(d(5783, 9, 30), 5785, 'adar2'), d(5785, 9, 30), '2024-12-31');
  });

  it('Adar I anchors stay in Adar I / plain Adar', () => {
    expectHebrewAndGregorian(anniversaryInYear(d(5779, 12, 5), 5783, 'adar2'), d(5783, 12, 5), '2023-02-26');
    expectHebrewAndGregorian(anniversaryInYear(d(5779, 12, 5), 5784, 'adar2'), d(5784, 12, 5), '2024-02-14');
  });

  it('Adar II anchors follow the last month regardless of the adar setting', () => {
    expectHebrewAndGregorian(anniversaryInYear(d(5779, 13, 5), 5783, 'adar1'), d(5783, 12, 5), '2023-02-26');
    expectHebrewAndGregorian(anniversaryInYear(d(5779, 13, 5), 5784, 'adar1'), d(5784, 13, 5), '2024-03-15');
  });

  it('Adar of a regular year defaults to Adar II (Purim stays on Purim) with an Adar I override', () => {
    expectHebrewAndGregorian(anniversaryInYear(d(5783, 12, 14), 5784, 'adar2'), d(5784, 13, 14), '2024-03-24');
    expectHebrewAndGregorian(anniversaryInYear(d(5783, 12, 14), 5784, 'adar1'), d(5784, 12, 14), '2024-02-23');
  });
});

describe('occurrenceInYear', () => {
  it('bar mitzvah occurs only in the 13th year, in Adar II for regular-year Adar births', () => {
    const bar = entry('barMitzvah', d(5769, 12, 14));
    expect(occurrenceInYear(bar, 5781)).toBeNull();
    expect(occurrenceInYear(bar, 5783)).toBeNull();
    const occ = occurrenceInYear(bar, 5782);
    expect(occ?.hebrew).toEqual(d(5782, 13, 14));
    expect(occ?.number).toBe(13);
    expect(hebrewPartsToDay(d(5782, 13, 14)).toISODate()).toBe('2022-03-17');
  });

  it('bat mitzvah occurs in the 12th year', () => {
    const bat = entry('batMitzvah', d(5773, 10, 3));
    expect(occurrenceInYear(bat, 5784)).toBeNull();
    const occ = occurrenceInYear(bat, 5785);
    expect(occ?.hebrew).toEqual(d(5785, 10, 3));
    expect(occ?.number).toBe(12);
    expect(hebrewPartsToDay(d(5785, 10, 3)).toISODate()).toBe('2025-01-03');
  });

  it('birthday counts age from 0 in the birth year; yahrzeit starts the following year', () => {
    const birthday = entry('birthday', d(5783, 12, 14));
    expect(occurrenceInYear(birthday, 5783)?.number).toBe(0);
    expect(occurrenceInYear(birthday, 5784)?.number).toBe(1);
    const yahrzeit = entry('yahrzeit', d(5783, 12, 14));
    expect(occurrenceInYear(yahrzeit, 5783)).toBeNull();
    expect(occurrenceInYear(yahrzeit, 5784)?.number).toBe(1);
  });

  it('applies kind defaults: yahrzeit → Adar I, birthday → Adar II', () => {
    expect(occurrenceInYear(entry('yahrzeit', d(5783, 12, 14)), 5784)?.hebrew).toEqual(d(5784, 12, 14));
    expect(occurrenceInYear(entry('birthday', d(5783, 12, 14)), 5784)?.hebrew).toEqual(d(5784, 13, 14));
    expect(occurrenceInYear(entry('yahrzeit', d(5783, 12, 14), 'adar2'), 5784)?.hebrew).toEqual(d(5784, 13, 14));
    expect(occurrenceInYear(entry('birthday', d(5783, 12, 14), 'adar1'), 5784)?.hebrew).toEqual(d(5784, 12, 14));
  });
});

describe('occurrencesOn', () => {
  it('matches every entry observed on the day, across differing anchors', () => {
    // Both anchors resolve to 1 Kislev 5789 (2028-11-19): the 30 Cheshvan yahrzeit
    // advances there, and the birthday's own postponement lands on the same day.
    const yahrzeit = entry('yahrzeit', d(5787, 8, 30));
    const birthday = entry('birthday', d(5787, 8, 30));
    const other = entry('birthday', d(5779, 12, 5));
    const day = DateTime.fromISO('2028-11-19');
    const found = occurrencesOn(day, [yahrzeit, birthday, other]);
    expect(found.map((o) => o.entry.id).sort()).toEqual([birthday.id, yahrzeit.id].sort());
    expect(found.every((o) => o.hebrew.month === 9 && o.hebrew.day === 1)).toBe(true);
  });

  it('returns nothing on unrelated days and for empty lists', () => {
    expect(occurrencesOn(DateTime.fromISO('2028-11-20'), [entry('yahrzeit', d(5787, 8, 30))])).toEqual([]);
    expect(occurrencesOn(DateTime.fromISO('2028-11-19'), [])).toEqual([]);
  });
});

describe('nextOccurrence', () => {
  it('returns today when the observance is today, otherwise rolls to the next year', () => {
    const yahrzeit = entry('yahrzeit', d(5787, 8, 30));
    const onTheDay = nextOccurrence(yahrzeit, DateTime.fromISO('2027-11-30'));
    expect(onTheDay?.date.toISODate()).toBe('2027-11-30');
    expect(onTheDay?.hebrew).toEqual(d(5788, 8, 30));
    const after = nextOccurrence(yahrzeit, DateTime.fromISO('2027-12-01'));
    expect(after?.date.toISODate()).toBe('2028-11-19');
    expect(after?.hebrew).toEqual(d(5789, 9, 1));
  });

  it('bar mitzvah returns its one fixed date even when past', () => {
    const bar = entry('barMitzvah', d(5769, 12, 14));
    const next = nextOccurrence(bar, DateTime.fromISO('2025-01-01'));
    expect(next?.date.toISODate()).toBe('2022-03-17');
    expect(next?.number).toBe(13);
  });

  it('a yahrzeit right after the death waits for the first anniversary year', () => {
    // Death 30 Cheshvan 5785 (2024-12-01): first observance is in 5786.
    const yahrzeit = entry('yahrzeit', d(5785, 8, 30));
    const next = nextOccurrence(yahrzeit, DateTime.fromISO('2024-12-02'));
    expect(next?.hebrew.year).toBe(5786);
    expect(next?.number).toBe(1);
  });
});

describe('customDatesFingerprint', () => {
  const make = (id: string, label: string): CustomDate => ({ id, kind: 'birthday', label, hebrew: d(5760, 4, 22) });

  it('changes when any rendering-relevant field changes', () => {
    const base = [make('1', 'Rivka')];
    expect(customDatesFingerprint(base)).toBe(customDatesFingerprint([make('1', 'Rivka')]));
    expect(customDatesFingerprint(base)).not.toBe(customDatesFingerprint([make('1', 'Leah')]));
    expect(customDatesFingerprint(base)).not.toBe(customDatesFingerprint([{ ...make('1', 'Rivka'), kind: 'yahrzeit' }]));
    expect(customDatesFingerprint(base)).not.toBe(customDatesFingerprint([]));
  });

  it('does not collide when a label contains the delimiter characters', () => {
    // A naive `id|…|label` + `;` join lets a crafted label forge the two-entry
    // string, staling the calendar cache. JSON encoding keeps them distinct.
    const two = [make('1', 'A'), make('2', 'B')];
    const one = [make('1', 'A;2|birthday|5760-4-22||B')];
    expect(customDatesFingerprint(two)).not.toBe(customDatesFingerprint(one));
  });
});
