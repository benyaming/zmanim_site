import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCATION } from '@/lib/location';
import { ZMANIM } from '@/lib/zmanim';

import {
  buildExportGrid,
  dropEmptyColumns,
  type ExportColumn,
  fitColumnWeights,
  fitColumnWidths,
  fitFontSize,
  fittedHeaderHeight,
  headerRuns,
  MAX_TABLE_FONT_PX,
  MIN_TABLE_FONT_PX,
  rowLineCounts,
  transposeExportGrid,
} from './grid';
import { estimateMeasurer } from './measure';
import { buildZmanimTable } from './table';

const m = estimateMeasurer;

const BASE_OPTS = {
  location: DEFAULT_LOCATION, // Jerusalem
  candleLightingOffset: 18,
  useElevation: false,
  lehumra: false,
  locale: 'en',
};

/** A full calendar month — the range this export is overwhelmingly used for. */
const MONTH = buildZmanimTable({
  ...BASE_OPTS,
  start: DateTime.fromISO('2026-01-01'),
  end: DateTime.fromISO('2026-01-31'),
  keys: ZMANIM.map((z) => z.key),
});

/** The identity + day columns the tool enables by default, in its print form. */
const PRINT_COLUMNS: ExportColumn[] = [
  { key: 'dayWithMonth', header: 'Date', fields: ['dayWithMonth', 'hebrewDate', 'weekday'], maxWeight: 4.6, identity: true },
  { key: 'events', header: 'Holiday / Parsha', fields: ['holiday', 'parsha'], maxWeight: 5 },
  { key: 'candleLighting', header: 'Candle lighting', emphasis: true },
  { key: 'havdalah', header: 'Havdala' },
];

describe('headerRuns', () => {
  const grid = buildExportGrid(
    MONTH,
    [{ key: 'weekday', header: 'Day' }],
    [{ label: 'Alot', sub: '90 min', group: 'alot' }, { label: 'Alot', sub: '72 min', group: 'alot' }, { label: 'Sunrise' }],
  );

  it('spans consecutive columns of one base under a single tier-1 header', () => {
    expect(headerRuns(grid)).toEqual([
      { start: 0, span: 1, label: 'Day', full: true },
      { start: 1, span: 2, label: 'Alot', full: false },
      { start: 3, span: 1, label: 'Sunrise', full: true },
    ]);
  });

  it('never merges neighbours that only happen to share a label', () => {
    // Two ungrouped columns with the same text must stay separate headers —
    // merging them would silently claim they are opinions of one zman.
    const twins = buildExportGrid(MONTH, [], [{ label: 'Chatzot' }, { label: 'Chatzot' }]);
    expect(headerRuns(twins)).toHaveLength(2);
  });
});

describe('fitColumnWeights', () => {
  it('sizes a clock-time column at about one unit', () => {
    const grid = buildExportGrid(MONTH, [], [{ label: 'Shkia' }]);
    const [weight] = fitColumnWeights(grid, m);
    expect(weight).toBeGreaterThanOrEqual(0.7);
    expect(weight).toBeLessThanOrEqual(1.8);
  });

  it('collapses a column whose cells are all empty to the floor weight', () => {
    // A quiet month's holiday column should not hold a fixed share of the page.
    const grid = buildExportGrid(MONTH, [{ key: 'fastStart', header: 'X' }], []);
    const empty = { ...grid, rows: grid.rows.map(() => ['']) };
    expect(fitColumnWeights(empty, m)[0]).toBe(0.7);
  });

  it('caps a text column at its ceiling instead of letting a long value starve the rest', () => {
    const grid = buildExportGrid(MONTH, PRINT_COLUMNS, []);
    const events = { ...grid, rows: grid.rows.map((r) => [r[0], 'A very long holiday name that would eat the sheet', r[2], r[3]]) };
    expect(fitColumnWeights(events, m)[1]).toBeLessThanOrEqual(5);
  });

  it('halves a wrapping cell’s demand (it may take two lines)', () => {
    const grid = buildExportGrid(MONTH, [{ key: 'holiday', header: 'H', maxWeight: 99 }], []);
    const long = 'Eight little words that can wrap onto two lines';
    const rows = grid.rows.map(() => [long]);
    const straight = fitColumnWeights({ ...grid, rows }, m)[0];
    const wrapped = fitColumnWeights({ ...grid, rows, wrapTextColumns: true }, m)[0];
    expect(wrapped).toBeLessThan(straight);
    expect(wrapped).toBeGreaterThanOrEqual(straight / 2 - 0.1);
  });
});

describe('dropEmptyColumns', () => {
  const grid = buildExportGrid(MONTH, PRINT_COLUMNS, [{ label: 'Shkia' }]);

  it('drops all-empty columns and recounts the lead/key columns', () => {
    const blank = { ...grid, rows: grid.rows.map((r) => ['', ...r.slice(1)]) };
    const trimmed = dropEmptyColumns(blank);
    expect(trimmed.headers).toHaveLength(grid.headers.length - 1);
    expect(trimmed.keyColumns).toBe(0);
    expect(trimmed.leadColumns).toBe((grid.leadColumns ?? 0) - 1);
  });

  it('keeps a column whose only content is the em-dash "no time" answer', () => {
    const dashes = { ...grid, rows: grid.rows.map((r) => [...r.slice(0, -1), '—']) };
    expect(dropEmptyColumns(dashes).headers).toHaveLength(grid.headers.length);
  });
});

describe('fitColumnWidths', () => {
  it('hands every column its padding up front and sums to the full width', () => {
    const widths = fitColumnWidths([1, 1, 4.6, 0.7]);
    expect(widths.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 6);
    // Even the narrowest column keeps more than its bare padding share.
    for (const w of widths) expect(w).toBeGreaterThan(0);
  });
});

describe('fitFontSize', () => {
  it('clamps between the legibility floor and the sparse-table cap', () => {
    expect(fitFontSize([1, 1], m)).toBe(MAX_TABLE_FONT_PX);
    expect(fitFontSize(Array.from({ length: 200 }, () => 1), m)).toBe(MIN_TABLE_FONT_PX);
  });
});

describe('transposeExportGrid', () => {
  const grid = buildExportGrid(MONTH, PRINT_COLUMNS, [{ label: 'Shkia' }]);
  const week = {
    ...grid,
    rows: grid.rows.slice(0, 7),
    weekStarts: grid.weekStarts.slice(0, 7),
    rowKeys: grid.rowKeys.slice(0, 7),
  };
  const turned = transposeExportGrid(
    week,
    '',
    week.rows.map((_, i) => `Day ${i + 1}`),
    week.rows.map((_, i) => `${i + 1} Tevet`),
  );

  it('turns columns into rows and days into columns, Hebrew dates as the sub-header', () => {
    expect(turned.headers).toHaveLength(8);
    expect(turned.rows).toHaveLength(grid.headers.length);
    expect(turned.subHeaders.slice(1)).toEqual(week.rows.map((_, i) => `${i + 1} Tevet`));
    expect(turned.columnKeys).toEqual(['', ...week.rowKeys]);
  });

  it('carries the original text flags over as prose rows, and lets the label column wrap', () => {
    expect(turned.proseRows).toEqual(grid.text);
    expect(turned.wrapTextColumns).toBe(true);
  });
});

describe('rowLineCounts', () => {
  it('counts wrapped lines for prose cells and exactly one for time rows', () => {
    const grid = buildExportGrid(
      MONTH,
      [
        { key: 'dayWithMonth', header: 'Date', identity: true },
        { key: 'holiday', header: 'Holiday' },
      ],
      [{ label: 'Shkia' }],
    );
    // Long enough to overflow even the generous width a three-column sheet
    // hands the text column — the wrap estimate must see multiple lines.
    const long = Array.from({ length: 6 }, () => 'the laws of sanctifying the new month').join(' and ');
    const wrapped = {
      ...grid,
      wrapTextColumns: true,
      rows: grid.rows.map((r, i) => (i === 0 ? [r[0], long, r[2]] : r)),
    };
    const weights = fitColumnWeights(wrapped, m);
    const lines = rowLineCounts(wrapped, weights, 10, m);
    expect(lines[0]).toBeGreaterThan(1);
    expect(lines[1]).toBe(1);
  });
});

describe('fittedHeaderHeight', () => {
  it('charges for the opinion tier only when some column carries one', () => {
    const plain = buildExportGrid(MONTH, PRINT_COLUMNS, [{ label: 'Shkia' }]);
    const withSubs = buildExportGrid(MONTH, PRINT_COLUMNS, [{ label: 'Shkia', sub: 'Vilna Gaon', group: 'shkia' }]);
    const weightsA = { ...plain, weights: fitColumnWeights(plain, m) };
    const weightsB = { ...withSubs, weights: fitColumnWeights(withSubs, m) };
    expect(fittedHeaderHeight(weightsB, 10, m)).toBeGreaterThan(fittedHeaderHeight(weightsA, 10, m));
  });
});
