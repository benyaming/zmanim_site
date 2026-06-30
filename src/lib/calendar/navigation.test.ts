import { JewishDate } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { nextMonth, nextYear, prevMonth, prevYear } from './navigation';

describe('Gregorian navigation', () => {
  it('moves forward and back by exactly one month', () => {
    const date = DateTime.fromISO('2024-06-10');
    expect(nextMonth(date, 'gregorian').month).toBe(7);
    expect(prevMonth(date, 'gregorian').month).toBe(5);
  });

  it('round-trips to the same month', () => {
    for (let m = 0; m < 24; m++) {
      const date = DateTime.fromISO('2023-01-10').plus({ months: m });
      const round = prevMonth(nextMonth(date, 'gregorian'), 'gregorian');
      expect(round.month).toBe(date.month);
      expect(round.year).toBe(date.year);
    }
  });

  it('does not overflow short months (Jan 31 -> Feb, not March)', () => {
    // Anchoring on the 15th prevents the classic plus/minus-month overflow.
    expect(prevMonth(DateTime.fromISO('2024-03-31'), 'gregorian').month).toBe(2);
    expect(nextMonth(DateTime.fromISO('2024-01-31'), 'gregorian').month).toBe(2);
  });
});

describe('Year navigation', () => {
  it('moves a Gregorian year keeping the month', () => {
    const date = DateTime.fromISO('2024-06-10');
    expect(nextYear(date, 'gregorian').year).toBe(2025);
    expect(nextYear(date, 'gregorian').month).toBe(6);
    expect(prevYear(date, 'gregorian').year).toBe(2023);
  });

  it('moves a Hebrew year keeping the month', () => {
    const date = DateTime.fromISO('2024-03-20'); // Adar II 5784 (leap)
    const year = new JewishDate(date).getJewishYear();
    expect(new JewishDate(nextYear(date, 'hebrew')).getJewishYear()).toBe(year + 1);
    expect(new JewishDate(prevYear(date, 'hebrew')).getJewishYear()).toBe(year - 1);
  });

  it('clamps Adar II to Adar when the target Hebrew year is not a leap year', () => {
    // 5784 is leap (has Adar II); 5783 is not — must not throw, lands in Adar.
    const adarII = DateTime.fromISO('2024-03-20');
    expect(() => prevYear(adarII, 'hebrew')).not.toThrow();
    const result = new JewishDate(prevYear(adarII, 'hebrew'));
    expect(result.getJewishYear()).toBe(5783);
    expect(result.getJewishMonth()).toBe(12); // Adar (not 13)
  });
});

describe('Hebrew navigation', () => {
  it('actually changes the Hebrew month (legacy fall-through bug)', () => {
    const date = DateTime.fromISO('2024-03-20'); // Adar II 5784
    const startMonth = new JewishDate(date).getJewishMonth();
    const next = new JewishDate(nextMonth(date, 'hebrew')).getJewishMonth();
    const prev = new JewishDate(prevMonth(date, 'hebrew')).getJewishMonth();
    expect(next).not.toBe(startMonth);
    expect(prev).not.toBe(startMonth);
  });

  it('round-trips to the same Hebrew month/year across a full (leap) year', () => {
    let date: DateTime = DateTime.fromISO('2023-09-20');
    for (let i = 0; i < 14; i++) {
      const jd = new JewishDate(date);
      const month = jd.getJewishMonth();
      const year = jd.getJewishYear();

      const round = prevMonth(nextMonth(date, 'hebrew'), 'hebrew');
      const rjd = new JewishDate(round);
      expect(rjd.getJewishMonth(), `month at step ${i}`).toBe(month);
      expect(rjd.getJewishYear(), `year at step ${i}`).toBe(year);

      date = nextMonth(date, 'hebrew');
    }
  });

  it('advances through every Hebrew month of a leap year without repeating', () => {
    // A Jewish leap year has 13 months; stepping 13 times returns to the start month.
    let date: DateTime = DateTime.fromISO('2023-09-20'); // Tishrei 5784 (leap year)
    const start = new JewishDate(date);
    const startMonth = start.getJewishMonth();
    const seen = new Set<number>();
    for (let i = 0; i < 13; i++) {
      seen.add(new JewishDate(date).getJewishMonth());
      date = nextMonth(date, 'hebrew');
    }
    expect(seen.size).toBe(13); // all 13 distinct months visited
    expect(new JewishDate(date).getJewishMonth()).toBe(startMonth); // wrapped around
  });
});
