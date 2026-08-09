import { JewishDate } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  hebrewMonthAnchor,
  hebrewMonthSpan,
  hebrewMonthsOfYear,
  isHebrewLeapYear,
  MAX_GRID_MONTHS,
  monthsInRange,
  monthTitle,
  weekdayHeaders,
} from './months';

describe('monthsInRange', () => {
  it('lists every Gregorian month anchor from start to end inclusive', () => {
    const months = monthsInRange(DateTime.fromISO('2026-01-20'), DateTime.fromISO('2026-03-02'), 'gregorian');
    expect(months.map((m) => `${m.year}-${m.month}-${m.day}`)).toEqual(['2026-1-15', '2026-2-15', '2026-3-15']);
  });

  it('returns a single month when start and end fall in the same month', () => {
    const months = monthsInRange(DateTime.fromISO('2026-07-01'), DateTime.fromISO('2026-07-31'), 'gregorian');
    expect(months).toHaveLength(1);
  });

  it('returns empty when the end precedes the start', () => {
    expect(monthsInRange(DateTime.fromISO('2026-03-01'), DateTime.fromISO('2026-01-01'), 'gregorian')).toHaveLength(0);
  });

  it('stops at MAX_GRID_MONTHS + 1 so callers can detect an over-cap range', () => {
    const months = monthsInRange(DateTime.fromISO('2020-01-01'), DateTime.fromISO('2030-01-01'), 'gregorian');
    expect(months).toHaveLength(MAX_GRID_MONTHS + 1);
  });

  it('walks Hebrew months in Hebrew mode — a leap year spans 13 months', () => {
    expect(isHebrewLeapYear(5787)).toBe(true);
    const months = monthsInRange(hebrewMonthAnchor(5787, 7), hebrewMonthAnchor(5787, 6), 'hebrew');
    expect(months).toHaveLength(13);
    for (const anchor of months) expect(new JewishDate(anchor).getJewishYear()).toBe(5787);
  });
});

describe('hebrewMonthsOfYear', () => {
  it('orders months Tishrei-first and includes Adar II only in leap years', () => {
    expect(isHebrewLeapYear(5786)).toBe(false);
    const plain = hebrewMonthsOfYear(5786, 'en');
    expect(plain).toHaveLength(12);
    expect(plain[0].month).toBe(7); // Tishrei
    expect(plain.some((m) => m.month === 13)).toBe(false);

    const leap = hebrewMonthsOfYear(5787, 'en');
    expect(leap).toHaveLength(13);
    expect(leap.map((m) => m.month).slice(5, 7)).toEqual([12, 13]); // Adar I, Adar II
  });
});

describe('hebrewMonthSpan', () => {
  it('returns the civil first and last day of the containing Hebrew month', () => {
    // Av 5786 runs Jul 15 – Aug 13 2026; Elul begins Aug 14.
    const av = hebrewMonthSpan(DateTime.fromISO('2026-08-09'));
    expect(av.start.toISODate()).toBe('2026-07-15');
    expect(av.end.toISODate()).toBe('2026-08-13');
    const elul = hebrewMonthSpan(DateTime.fromISO('2026-08-14'));
    expect(elul.start.toISODate()).toBe('2026-08-14');
  });
});

describe('hebrewMonthAnchor', () => {
  it('anchors on the 15th of the requested Hebrew month', () => {
    const jd = new JewishDate(hebrewMonthAnchor(5786, 1)); // Nissan 5786
    expect(jd.getJewishMonth()).toBe(1);
    expect(jd.getJewishDayOfMonth()).toBe(15);
  });

  it('clamps Adar II to Adar in non-leap years', () => {
    expect(new JewishDate(hebrewMonthAnchor(5786, 13)).getJewishMonth()).toBe(12);
  });
});

describe('titles and headers', () => {
  it('formats the Gregorian month title', () => {
    expect(monthTitle(DateTime.fromISO('2026-01-15'), 'gregorian', 'en')).toBe('January 2026');
  });

  it('formats the Hebrew month title with the Jewish year', () => {
    expect(monthTitle(hebrewMonthAnchor(5786, 7), 'hebrew', 'en')).toBe('Tishrei 5786');
  });

  it('starts weekday headers on Sunday', () => {
    expect(weekdayHeaders('en')[0]).toBe('Sun');
    expect(weekdayHeaders('en')).toHaveLength(7);
  });
});
