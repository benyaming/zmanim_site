import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { formatTime } from '@/lib/format';
import { getDailyLearning } from '@/lib/learning';
import { DEFAULT_LOCATION } from '@/lib/location';
import { computeZmanim } from '@/lib/zmanim';

import { exportGridToCsv } from './csv';
import { buildExportGrid, paginateExportGrid, transposeExportGrid } from './grid';
import { buildZmanimTable, orderedZmanKeys, tableDayCount } from './table';

const BASE_OPTS = {
  location: DEFAULT_LOCATION, // Jerusalem
  candleLightingOffset: 18,
  useElevation: false,
  lehumra: false,
  locale: 'en',
};

describe('orderedZmanKeys', () => {
  it('re-orders selected keys to the canonical definition order and drops unknowns', () => {
    expect(orderedZmanKeys(['tzais', 'sunrise', 'nope', 'shaahZmanisGRA', 'sunset'])).toEqual([
      'sunrise',
      'sunset',
      'tzais',
      'shaahZmanisGRA',
    ]);
  });
});

describe('tableDayCount', () => {
  it('counts inclusive days', () => {
    expect(tableDayCount(DateTime.fromISO('2026-01-04'), DateTime.fromISO('2026-01-10'))).toBe(7);
    expect(tableDayCount(DateTime.fromISO('2026-01-04'), DateTime.fromISO('2026-01-04'))).toBe(1);
  });

  it('returns 0 for a reversed range', () => {
    expect(tableDayCount(DateTime.fromISO('2026-01-10'), DateTime.fromISO('2026-01-04'))).toBe(0);
  });

  it('counts calendar days, not 24-hour periods, across DST transitions', () => {
    // Israel springs forward on 2026-03-27, so the 27th's midnight-to-midnight
    // span is 23 hours. Luxon's day-diff is calendar-aware, so the inclusive
    // count must still be exact — 3 days, not floor(2.96) + 1 = 2.
    const zone = 'Asia/Jerusalem';
    expect(tableDayCount(DateTime.fromISO('2026-03-26', { zone }), DateTime.fromISO('2026-03-28', { zone }))).toBe(3);
    // And across a fall-back (25-hour day): America/New_York, 2025-11-02.
    const ny = 'America/New_York';
    expect(tableDayCount(DateTime.fromISO('2025-11-01', { zone: ny }), DateTime.fromISO('2025-11-03', { zone: ny }))).toBe(3);
  });
});

describe('buildZmanimTable', () => {
  const start = DateTime.fromISO('2026-01-04');
  const end = DateTime.fromISO('2026-01-10');
  const table = buildZmanimTable({
    ...BASE_OPTS,
    start,
    end,
    keys: ['tzais', 'sunrise', 'sunset', 'shaahZmanisGRA'],
  });

  it('emits one row per day, cells aligned with the ordered keys', () => {
    expect(table.keys).toEqual(['sunrise', 'sunset', 'tzais', 'shaahZmanisGRA']);
    expect(table.rows).toHaveLength(7);
    expect(table.rows[0].iso).toBe('2026-01-04');
    expect(table.rows[6].iso).toBe('2026-01-10');
    for (const row of table.rows) expect(row.cells).toHaveLength(4);
  });

  it('formats clock times exactly like the day panel', () => {
    const zmanim = computeZmanim({
      lat: DEFAULT_LOCATION.lat,
      lng: DEFAULT_LOCATION.lng,
      date: start,
      timeZoneId: DEFAULT_LOCATION.timeZoneId,
      candleLightingOffset: 18,
    });
    const sunrise = zmanim.find((z) => z.key === 'sunrise')!;
    expect(table.rows[0].cells[0]).toBe(formatTime(sunrise.time, 'en'));
  });

  it('formats the shaah zmanis as an h:mm:ss duration', () => {
    expect(table.rows[0].cells[3]).toMatch(/^\d+:\d{2}:\d{2}$/);
  });

  it('fills the date/weekday/Hebrew-date columns', () => {
    const row = table.rows[0];
    expect(row.weekday).toBe('Sun');
    expect(row.dateLabel).toContain('2026');
    expect(row.hebrewDate).toMatch(/\d+ \S+/);
  });

  it('fills the day-event and parsha columns like the calendar cells', () => {
    // 2026-01-09 is a Friday, 2026-01-10 its Shabbat (Parashat Shemos, no fast).
    const friday = table.rows[5];
    const shabbat = table.rows[6];
    expect(friday.candleLighting).toMatch(/\d+:\d{2}/);
    expect(friday.havdalah).toBe('');
    expect(shabbat.havdalah).toMatch(/\d+:\d{2}/);
    expect(shabbat.candleLighting).toBe('');
    expect(shabbat.parsha).not.toBe('');
    expect(friday.parsha).toBe(''); // parsha rides only the Shabbat row
    expect(friday.fastStart).toBe('');
    expect(friday.fastEnd).toBe('');
  });

  it('fills the fast bookends on a fast day', () => {
    // 2026-07-02 is 17 Tammuz.
    const fast = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-07-02'),
      end: DateTime.fromISO('2026-07-02'),
      keys: ['sunrise'],
    }).rows[0];
    expect(fast.fastStart).toMatch(/\d+:\d{2}/);
    expect(fast.fastEnd).toMatch(/\d+:\d{2}/);
    expect(fast.candleLighting).toBe('');
  });

  it('appends the special-Shabbat name to the parsha via the provided label', () => {
    // 2026-03-14 is Shabbat Parashat Vayakhel — Shabbat Parah 5786.
    const parah = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-03-14'),
      end: DateTime.fromISO('2026-03-14'),
      keys: ['sunrise'],
      specialShabbatLabel: (name) => `Shabbat ${name}`,
    }).rows[0];
    expect(parah.parsha).toContain(' · Shabbat ');
    // The Shabbat before Rosh Chodesh Nissan is also Shabbat Mevarchim.
    expect(parah.mevarchim).toBe('✓');
  });

  it('fills the omer column during the counting period only', () => {
    // 2026-04-10 is 23 Nissan 5786 — the 8th day of the omer.
    const omerRow = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-04-10'),
      end: DateTime.fromISO('2026-04-10'),
      keys: ['sunrise'],
    }).rows[0];
    expect(omerRow.omer).toBe('8');
    expect(table.rows[0].omer).toBe(''); // January — outside the count
    expect(table.rows[0].mevarchim).toBe('');
  });

  it('names the holiday on significant days and leaves weekdays empty', () => {
    // 2026-04-02 is 15 Nissan — the first day of Pesach.
    const pesach = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-04-01'),
      end: DateTime.fromISO('2026-04-02'),
      keys: ['sunrise'],
    });
    expect(pesach.rows[1].holiday).toContain('Pesach');
    expect(table.rows[0].holiday).toBe(''); // a plain Sunday
  });

  it('leaves learning columns empty when no learning is requested', () => {
    expect(table.rows[0].dafYomi).toBe('');
    expect(table.rows[0].mishnaYomit).toBe('');
  });

  it('fills requested learning columns with the same reading as the day panel', () => {
    const day = DateTime.fromISO('2026-01-04');
    const row = buildZmanimTable({
      ...BASE_OPTS,
      start: day,
      end: day,
      keys: ['sunrise'],
      learningKeys: ['dafYomi', 'tehillim'],
    }).rows[0];
    const learning = getDailyLearning(day, DEFAULT_LOCATION.inIsrael, 'en');
    expect(row.dafYomi).toBe(learning.find((l) => l.key === 'dafYomi')!.reading);
    expect(row.tehillim).toBe(learning.find((l) => l.key === 'tehillim')!.reading);
  });
});

describe('exportGridToCsv', () => {
  const table = buildZmanimTable({
    ...BASE_OPTS,
    start: DateTime.fromISO('2026-01-04'),
    end: DateTime.fromISO('2026-01-05'),
    keys: ['sunrise', 'sunset'],
    learningKeys: ['dafYomi'],
  });

  const grid = buildExportGrid(
    table,
    [
      { key: 'dateLabel', header: 'Date' },
      { key: 'weekday', header: 'Day' },
      { key: 'hebrewDate', header: 'Hebrew date' },
      { key: 'holiday', header: 'Holiday' },
      { key: 'dafYomi', header: 'Daf Yomi' },
    ],
    ['Sunrise', 'Sunset'],
  );
  const csv = exportGridToCsv(grid, 'Generated by example.com');
  const lines = csv.split('\r\n');

  it('starts with a header row and has one line per day plus a blank + footer row', () => {
    expect(lines[0]).toBe('Date,Day,Hebrew date,Holiday,Daf Yomi,Sunrise,Sunset');
    expect(lines).toHaveLength(1 + 2 + 2); // header + 2 days + blank + footer
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('Generated by example.com');
  });

  it('includes the daily-learning reading in each data row', () => {
    expect(lines[1].split(',')).toContain(table.rows[0].dafYomi);
    expect(table.rows[0].dafYomi).not.toBe('');
  });

  it('drops a disabled leading column entirely (no fixed columns are hardcoded)', () => {
    const noDate = exportGridToCsv(
      buildExportGrid(table, [{ key: 'holiday', header: 'Holiday' }], ['Sunrise']),
      'f',
    );
    expect(noDate.split('\r\n')[0]).toBe('Holiday,Sunrise');
  });

  it('appends a compute-option note row before the footer', () => {
    const out = exportGridToCsv(grid, 'Generated by example.com', 'Elevation-adjusted (800 m)').split('\r\n');
    expect(out[out.length - 2]).toBe('Elevation-adjusted (800 m)');
    expect(out[out.length - 1]).toBe('Generated by example.com');
  });

  it('quotes cells that contain a comma or quote', () => {
    const quoted = exportGridToCsv(
      { headers: ['a,b', 'c"d'], weights: [1, 1], text: [false, false], sticky: [false, false], rows: [] },
      'plain',
    );
    expect(quoted.split('\r\n')[0]).toBe('"a,b","c""d"');
  });

  it('transposes fields to rows and days to columns', () => {
    const t = transposeExportGrid(
      buildExportGrid(table, [{ key: 'dateLabel', header: 'Date' }], ['Sunrise', 'Sunset']),
      '',
      table.rows.map((r) => r.dateLabel),
    );
    const out = exportGridToCsv(t, 'foot').split('\r\n');
    const days = table.rows.map((r) => r.dateLabel).join(',');
    // Corner + one column per day, then a row per field (Date, Sunrise, Sunset).
    expect(out[0]).toBe(`,${days}`);
    expect(out[1]).toBe(`Date,${days}`);
    expect(out[2]).toBe(`Sunrise,${table.rows.map((r) => r.cells[0]).join(',')}`);
  });
});

describe('paginateExportGrid column pagination', () => {
  const table = buildZmanimTable({
    ...BASE_OPTS,
    start: DateTime.fromISO('2026-01-04'),
    end: DateTime.fromISO('2026-01-05'),
    keys: ['sunrise', 'sunset'],
  });

  it('keeps a modest table on a single column-page', () => {
    const grid = buildExportGrid(table, [{ key: 'dateLabel', header: 'Date' }], ['Sunrise', 'Sunset']);
    const pages = paginateExportGrid(grid, false);
    expect(pages).toHaveLength(1);
    expect(pages[0].headers).toEqual(['Date', 'Sunrise', 'Sunset']);
  });

  it('splits many columns across pages and repeats the identity columns on each', () => {
    const many = Array.from({ length: 40 }, (_, i) => `Z${i}`);
    const grid = buildExportGrid(
      table,
      [
        { key: 'dateLabel', header: 'Date' },
        { key: 'holiday', header: 'Holiday' },
      ],
      many,
    );
    const pages = paginateExportGrid(grid, false);
    expect(pages.length).toBeGreaterThan(1);
    // Identity columns lead every page.
    for (const p of pages) expect(p.headers.slice(0, 2)).toEqual(['Date', 'Holiday']);
    // The data columns are partitioned across pages — all present, none duplicated.
    const dataHeaders = pages.flatMap((p) => p.headers.slice(2));
    expect(dataHeaders).toHaveLength(40);
    expect(new Set(dataHeaders).size).toBe(40);
  });
});
