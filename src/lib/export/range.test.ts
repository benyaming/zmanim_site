import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { hebrewMonthSpan } from './months';
import { fitRangeEnd, rangeLatestEnd, wholeMonthEndWithin } from './range';
import { MAX_TABLE_DAYS } from './table';

const MAX = MAX_TABLE_DAYS; // 732, the cap both date-range tools use

describe('rangeLatestEnd', () => {
  it('allows an end up to maxDays from the start, counting both', () => {
    expect(MAX).toBe(732);
    expect(rangeLatestEnd('2026-09-01', MAX)).toBe('2028-09-01'); // + 731 days (2028 is a leap year)
    expect(rangeLatestEnd('2026-09-01', 1)).toBe('2026-09-01');
    expect(rangeLatestEnd('garbage', MAX)).toBe('');
  });
});

describe('fitRangeEnd', () => {
  it('keeps the end while it still fits after the start moves', () => {
    expect(fitRangeEnd('2026-10-01', '2027-08-31', 365, MAX)).toBe('2027-08-31');
    expect(fitRangeEnd('2026-10-01', '2026-10-01', 365, MAX)).toBe('2026-10-01'); // a one-day range
  });

  it('moves a reversed end so the range keeps its length', () => {
    // Start moved past the end: a 31-day range stays 31 days long.
    expect(fitRangeEnd('2027-02-01', '2026-10-31', 31, MAX)).toBe('2027-03-03');
  });

  it('pulls an over-long end back within the cap', () => {
    // Start moved back two years: the old end would make the range too long.
    expect(fitRangeEnd('2025-01-01', '2027-08-31', 365, MAX)).toBe('2025-12-31');
    expect(fitRangeEnd('2025-01-01', '2028-01-01', MAX + 50, MAX)).toBe(rangeLatestEnd('2025-01-01', MAX));
  });
});

describe('wholeMonthEndWithin', () => {
  const civilMonth = (d: DateTime) => ({ start: d.startOf('month'), end: d.endOf('month').startOf('day') });

  it('leaves an end that already fits', () => {
    const start = DateTime.fromISO('2026-09-01');
    const end = DateTime.fromISO('2027-08-31');
    expect(wholeMonthEndWithin(start, end, MAX, civilMonth).toISODate()).toBe('2027-08-31');
  });

  it('pulls a snapped civil end back to the last whole month inside the cap', () => {
    // 1 Sep 2026 + 732 days reaches 1 Sep 2028, mid-way into September:
    // the last whole month that fits is August 2028.
    const start = DateTime.fromISO('2026-09-01');
    const end = DateTime.fromISO('2028-09-30');
    expect(wholeMonthEndWithin(start, end, MAX, civilMonth).toISODate()).toBe('2028-08-31');
  });

  it('keeps a month that ends exactly on the cap', () => {
    // 1 Sep 2026 + 730 days is 31 Aug 2028, the last day of a month.
    const start = DateTime.fromISO('2026-09-01');
    const end = DateTime.fromISO('2028-09-30');
    expect(wholeMonthEndWithin(start, end, 731, civilMonth).toISODate()).toBe('2028-08-31');
  });

  it('works on Hebrew months', () => {
    const start = hebrewMonthSpan(DateTime.fromISO('2026-09-12')).start; // 1 Tishrei 5787
    const far = hebrewMonthSpan(start.plus({ days: MAX + 20 })).end;
    const end = wholeMonthEndWithin(start, far, MAX, hebrewMonthSpan);
    expect(end <= start.plus({ days: MAX - 1 })).toBe(true);
    // A Hebrew month's last day: the next day starts a new month.
    expect(hebrewMonthSpan(end.plus({ days: 1 })).start.toISODate()).toBe(end.plus({ days: 1 }).toISODate());
  });
});
