import { describe, expect, it } from 'vitest';

import { anniversaryInYear, hebrewPartsToDay, yahrzeitInYear } from './anniversaries';
import type { HebrewDateParts } from './types';

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
