import { JewishDate } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { buildMonthGrid, daysInActiveMonth } from './grid';

describe('buildMonthGrid (Gregorian)', () => {
  it('always starts on Sunday and has a whole number of weeks', () => {
    for (let m = 0; m < 36; m++) {
      const date = DateTime.fromISO('2023-01-15').plus({ months: m });
      const grid = buildMonthGrid(date, 'gregorian');
      expect(grid.cells[0].date.weekday, `month ${date.toISODate()}`).toBe(7); // Luxon Sunday
      expect(grid.cells.length).toBe(grid.weeks * 7);
      expect(grid.weeks).toBeGreaterThanOrEqual(4);
      expect(grid.weeks).toBeLessThanOrEqual(6);
    }
  });

  it('includes every day of the month exactly once, contiguously', () => {
    for (let m = 0; m < 36; m++) {
      const date = DateTime.fromISO('2023-01-15').plus({ months: m });
      const grid = buildMonthGrid(date, 'gregorian');
      const inMonth = grid.cells.filter((c) => c.inMonth);
      expect(inMonth.length).toBe(date.daysInMonth);
      expect(inMonth[0].date.day).toBe(1);
      expect(inMonth[inMonth.length - 1].date.day).toBe(date.daysInMonth);
      // contiguous block
      const firstIdx = grid.cells.findIndex((c) => c.inMonth);
      for (let i = 0; i < inMonth.length; i++) {
        expect(grid.cells[firstIdx + i].inMonth).toBe(true);
      }
    }
  });

  it('handles a 6-week month without dropping days (the legacy 35-cell bug)', () => {
    // March 2025: the 1st is a Saturday, so it spans 6 weeks (prepend 6 + 31 = 37).
    // The old formula appendDays = 35 - 31 - 6 = -2 dropped days here.
    const grid = buildMonthGrid(DateTime.fromISO('2025-03-15'), 'gregorian');
    expect(grid.weeks).toBe(6);
    expect(grid.cells.filter((c) => c.inMonth).length).toBe(31);
  });

  it('padding cells are the adjacent days', () => {
    const grid = buildMonthGrid(DateTime.fromISO('2024-02-15'), 'gregorian');
    // cells are consecutive days overall
    for (let i = 1; i < grid.cells.length; i++) {
      const diff = grid.cells[i].date.diff(grid.cells[i - 1].date, 'days').days;
      expect(Math.round(diff)).toBe(1);
    }
  });
});

describe('buildMonthGrid (Hebrew)', () => {
  it('covers exactly the Hebrew month, Sunday-first', () => {
    // Sweep a full leap year (5784 has Adar I & II) month by month.
    for (let m = 0; m < 14; m++) {
      const date = DateTime.fromISO('2023-09-20').plus({ months: m });
      const grid = buildMonthGrid(date, 'hebrew');
      const expectedDays = daysInActiveMonth(date, 'hebrew');
      expect(grid.cells[0].date.weekday, `hebrew month around ${date.toISODate()}`).toBe(7);
      expect(grid.cells.filter((c) => c.inMonth).length).toBe(expectedDays);
      expect(grid.cells.length).toBe(grid.weeks * 7);
    }
  });

  it('first in-month cell is the 1st of the Hebrew month', () => {
    const date = DateTime.fromISO('2024-03-20'); // Adar II 5784
    const grid = buildMonthGrid(date, 'hebrew');
    const firstInMonth = grid.cells.find((c) => c.inMonth)!;
    const jd = new JewishDate(firstInMonth.date);
    expect(jd.getJewishDayOfMonth()).toBe(1);
  });

  it('emits cells that compare via DateTime#hasSame (kosher-zmanim Luxon isolation)', () => {
    // Regression: kosher-zmanim bundles its own Luxon, so JewishDate.getDate()
    // returns a DateTime with a foreign zone object. hasSame() against the app's
    // Luxon then wrongly reports a same-instant date as a *different* day, so the
    // Hebrew grid never highlighted "today"/the selected day. Cells must rebuild
    // in the app's Luxon.
    const anchor = DateTime.fromObject({ year: 2026, month: 7, day: 1 }); // 16 Tammuz 5786
    const grid = buildMonthGrid(anchor, 'hebrew');
    const target = DateTime.fromObject({ year: 2026, month: 7, day: 1 });
    const match = grid.cells.filter((c) => c.date.hasSame(target, 'day'));
    expect(match).toHaveLength(1);
    expect(match[0].inMonth).toBe(true);
  });
});
