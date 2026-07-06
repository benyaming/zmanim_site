import { JewishDate } from 'kosher-zmanim';
import { describe, expect, it } from 'vitest';

import { daysInJewishMonth, isHebrewLeapYear } from '@/lib/calendar';

import { anniversaryInYear, hebrewPartsToDay, yahrzeitInYear } from './occurrences';
import type { AdarBehavior, HebrewDateParts } from './types';

/**
 * Structural invariants over a wide year sweep, complementing the pinned golden
 * cases. These would have caught a mis-transcription that produced an invalid
 * date (e.g. a 30th in a 29-day month) even where no golden row exercised it.
 */

const YEARS: number[] = [];
for (let y = 5760; y <= 5810; y++) YEARS.push(y);

// One anchor per rule branch (both leap and non-leap origin years).
const ANCHORS: HebrewDateParts[] = [
  { year: 5787, month: 8, day: 30 }, // 30 Cheshvan (long first-anniv year)
  { year: 5780, month: 8, day: 30 }, // 30 Cheshvan (short first-anniv year)
  { year: 5783, month: 9, day: 30 }, // 30 Kislev (short first-anniv year)
  { year: 5786, month: 9, day: 30 }, // 30 Kislev (long first-anniv year)
  { year: 5774, month: 12, day: 30 }, // 30 Adar I (leap origin)
  { year: 5783, month: 12, day: 14 }, // 14 Adar (regular origin)
  { year: 5779, month: 12, day: 5 }, // 5 Adar I (leap origin)
  { year: 5779, month: 13, day: 5 }, // 5 Adar II (leap origin)
  { year: 5782, month: 13, day: 10 }, // 10 Adar II (leap origin)
  { year: 5784, month: 6, day: 20 }, // 20 Elul (ordinary, no edge case)
  { year: 5784, month: 1, day: 1 }, // 1 Nisan
];

const ADARS: AdarBehavior[] = ['adar1', 'adar2'];

const lastMonth = (year: number): number => (isHebrewLeapYear(year) ? 13 : 12);

function assertValid(parts: HebrewDateParts, hyear: number) {
  expect(parts.year).toBe(hyear);
  expect(parts.month).toBeGreaterThanOrEqual(1);
  expect(parts.month).toBeLessThanOrEqual(lastMonth(hyear));
  expect(parts.day).toBeGreaterThanOrEqual(1);
  expect(parts.day).toBeLessThanOrEqual(daysInJewishMonth(hyear, parts.month));
}

function assertRoundTrips(parts: HebrewDateParts) {
  const jd = new JewishDate(hebrewPartsToDay(parts));
  expect({ year: jd.getJewishYear(), month: jd.getJewishMonth(), day: jd.getJewishDayOfMonth() }).toEqual(parts);
}

describe('anniversary/yahrzeit invariants', () => {
  it('every produced date is valid for its year and survives a Gregorian round-trip', () => {
    for (const anchor of ANCHORS) {
      for (const hyear of YEARS) {
        for (const adar of ADARS) {
          const anniv = anniversaryInYear(anchor, hyear, adar);
          if (anniv) {
            assertValid(anniv, hyear);
            assertRoundTrips(anniv);
          }
          const yahr = yahrzeitInYear(anchor, hyear, adar);
          if (yahr) {
            assertValid(yahr, hyear);
            assertRoundTrips(yahr);
          }
        }
      }
    }
  });

  it('produces exactly one anniversary/yahrzeit per eligible year', () => {
    for (const anchor of ANCHORS) {
      expect(anniversaryInYear(anchor, anchor.year - 1, 'adar1')).toBeNull();
      expect(anniversaryInYear(anchor, anchor.year, 'adar1')).not.toBeNull();
      expect(yahrzeitInYear(anchor, anchor.year, 'adar1')).toBeNull();
      expect(yahrzeitInYear(anchor, anchor.year + 1, 'adar1')).not.toBeNull();
    }
  });

  it('passes a non-edge anchor through verbatim when its month/day exists in the target year', () => {
    const anchor = { year: 5784, month: 6, day: 20 }; // 20 Elul — never an edge case
    for (const hyear of YEARS) {
      if (hyear <= anchor.year) continue;
      expect(anniversaryInYear(anchor, hyear, 'adar1')).toEqual({ year: hyear, month: 6, day: 20 });
      expect(yahrzeitInYear(anchor, hyear, 'adar1')).toEqual({ year: hyear, month: 6, day: 20 });
    }
  });

  it('adar1 and adar2 differ only for Adar-of-a-regular-year anchors in leap target years', () => {
    for (const anchor of ANCHORS) {
      const anchorIsPlainAdar = anchor.month === 12 && !isHebrewLeapYear(anchor.year);
      for (const hyear of YEARS) {
        const a1 = yahrzeitInYear(anchor, hyear, 'adar1');
        const a2 = yahrzeitInYear(anchor, hyear, 'adar2');
        const shouldDiffer = anchorIsPlainAdar && isHebrewLeapYear(hyear) && hyear > anchor.year;
        if (shouldDiffer) expect(a1).not.toEqual(a2);
        else expect(a1).toEqual(a2);
      }
    }
  });
});
