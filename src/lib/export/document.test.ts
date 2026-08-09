import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import en from '../../../messages/en.json';
import ru from '../../../messages/ru.json';
import { LEARNING_CYCLE_KEYS } from '@/lib/learning';
import { DEFAULT_LOCATION } from '@/lib/location';
import { CONFIGURABLE_ZMANIM, DEFAULT_HIDDEN_ZMANIM, ZMANIM } from '@/lib/zmanim';

import { buildExportDocument, type ExportDocumentInput } from './document';
import { type ExportColumn, type ExportHeader, MAX_TABLE_FONT_PX, MIN_TABLE_FONT_PX } from './grid';
import { estimateMeasurer } from './measure';
import { buildZmanimTable, type ZmanimTable } from './table';

const m = estimateMeasurer;

interface Catalog {
  zmanim: { names: Record<string, string>; shitotShort: Record<string, string> };
  learning: Record<string, string>;
}
const CATALOGS = { en, ru } as unknown as Record<string, Catalog>;

/** The zmanim the export tool ticks by default — a month of these is the real workload. */
const DEFAULT_SELECTION = CONFIGURABLE_ZMANIM.filter((z) => !DEFAULT_HIDDEN_ZMANIM.includes(z.key)).map((z) => z.key);

const BASE_OPTS = {
  location: DEFAULT_LOCATION, // Jerusalem
  candleLightingOffset: 18,
  useElevation: false,
  lehumra: false,
};

function table(startIso: string, endIso: string, keys: string[], locale = 'en', learning = false): ZmanimTable {
  return buildZmanimTable({
    ...BASE_OPTS,
    locale,
    start: DateTime.fromISO(startIso),
    end: DateTime.fromISO(endIso),
    keys,
    learningKeys: learning ? [...LEARNING_CYCLE_KEYS] : [],
    mevarchimLabel: 'Mevarchim',
    moladLabel: ({ month, weekday, time }) => `Molad ${month}: ${weekday} ${time}`,
    plainTimes: true,
    fastEndLabel: (key) => `op:${key}`,
  });
}

/** The day columns exactly as the PDF builds them (export-pdf-doc.tsx). */
function dayColumns(): ExportColumn[] {
  return [
    {
      key: 'dayWithMonth',
      header: 'Date',
      fields: ['dayWithMonth', 'hebrewDate', 'weekday'],
      maxWeight: 4.6,
      identity: true,
    },
    { key: 'events', header: 'Holiday / Parsha', fields: ['holiday', 'parsha', 'mevarchimName'], maxWeight: 5 },
    { key: 'candleLighting', header: 'Candles', emphasis: true },
    { key: 'havdalah', header: 'Havdala' },
    { key: 'omer', header: 'Omer' },
  ];
}

/** Zman headers with the real short shita vocabulary, as the month sheets print them. */
function printHeaders(keys: string[], locale: string): ExportHeader[] {
  const { zmanim } = CATALOGS[locale];
  const perBase = new Map<string, number>();
  for (const z of ZMANIM) perBase.set(z.base, (perBase.get(z.base) ?? 0) + 1);
  return keys.map((key) => {
    const def = ZMANIM.find((z) => z.key === key)!;
    const label = zmanim.names[key].replace(/\s*\([^)]*\)/g, '').trim();
    return (perBase.get(def.base) ?? 1) > 1 ? { label, sub: zmanim.shitotShort[key], group: def.base } : { label };
  });
}

function learningColumns(locale: string): ExportColumn[] {
  const { learning } = CATALOGS[locale];
  return LEARNING_CYCLE_KEYS.map((key) => ({ key, header: learning[key] }));
}

function input(t: ZmanimTable, locale: string, opts: Partial<ExportDocumentInput> = {}): ExportDocumentInput {
  return {
    table: t,
    dayColumns: dayColumns(),
    zmanHeaders: printHeaders(t.keys, locale),
    learningColumns: [],
    weekly: false,
    ...opts,
  };
}

describe('buildExportDocument — month sheets', () => {
  it('emits one times sheet per month, in range order, partial months at the edges', () => {
    const t = table('2026-01-15', '2026-03-15', DEFAULT_SELECTION);
    const sheets = buildExportDocument(input(t, 'en'), m);
    expect(sheets.map((s) => s.kind)).toEqual(['times', 'times', 'times']);
    expect(sheets.map((s) => [s.startIso, s.endIso])).toEqual([
      ['2026-01-15', '2026-01-31'],
      ['2026-02-01', '2026-02-28'],
      ['2026-03-01', '2026-03-15'],
    ]);
    for (const sheet of sheets) {
      expect(sheet.part).toBe(1);
      expect(sheet.parts).toBe(1);
    }
  });

  it('pages by Hebrew month when asked: a sheet per Elul, split on Rosh Chodesh', () => {
    // 1 Elul 5786 falls on Aug 14 2026 — the range spans the tail of Av and Elul.
    const t = table('2026-08-06', '2026-09-05', DEFAULT_SELECTION);
    const sheets = buildExportDocument(input(t, 'en', { hebrewMonths: true }), m);
    expect(sheets.map((s) => [s.startIso, s.endIso])).toEqual([
      ['2026-08-06', '2026-08-13'],
      ['2026-08-14', '2026-09-05'],
    ]);
  });

  it('fits a default-selection month on one sheet at a legible size, all 31 days on it', () => {
    const t = table('2026-01-01', '2026-01-31', DEFAULT_SELECTION);
    const sheets = buildExportDocument(input(t, 'en'), m);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].grid.rows).toHaveLength(31);
    expect(sheets[0].fontPx).toBeGreaterThanOrEqual(MIN_TABLE_FONT_PX);
    expect(sheets[0].fontPx).toBeLessThanOrEqual(MAX_TABLE_FONT_PX);
  });

  it('interleaves each month’s learning sheet after its times sheet', () => {
    const t = table('2026-01-01', '2026-02-28', DEFAULT_SELECTION, 'en', true);
    const sheets = buildExportDocument(input(t, 'en', { learningColumns: learningColumns('en') }), m);
    expect(sheets.map((s) => `${s.kind}:${s.startIso.slice(0, 7)}`)).toEqual([
      'times:2026-01',
      'learning:2026-01',
      'times:2026-02',
      'learning:2026-02',
    ]);
  });

  it('inlines a lone short-valued cycle (Daf Yomi) into the times sheet, dropping the learning sheet', () => {
    const t = table('2026-01-01', '2026-01-31', DEFAULT_SELECTION, 'en', true);
    const daf: ExportColumn[] = [{ key: 'dafYomi', header: 'Daf Yomi' }];
    const sheets = buildExportDocument(input(t, 'en', { learningColumns: daf }), m);
    expect(sheets.map((s) => s.kind)).toEqual(['times']);
    const grid = sheets[0].grid;
    expect(grid.headers[grid.headers.length - 1]).toBe('Daf Yomi');
    expect(grid.rows[0][grid.headers.length - 1]).toMatch(/\d/);
  });

  it('keeps the separate learning sheet for a lone LONG-valued cycle (Rambam)', () => {
    const t = table('2026-01-01', '2026-01-31', DEFAULT_SELECTION, 'ru', true);
    const rambam = learningColumns('ru').filter((c) => c.key === 'rambam');
    const sheets = buildExportDocument(input(t, 'ru', { learningColumns: rambam }), m);
    expect(sheets.map((s) => s.kind)).toEqual(['times', 'learning']);
  });

  it('builds learning sheets alone when no zmanim or day columns are selected', () => {
    const t = table('2026-01-01', '2026-01-31', [], 'en', true);
    const sheets = buildExportDocument(
      input(t, 'en', { dayColumns: [], learningColumns: learningColumns('en') }),
      m,
    );
    expect(sheets.every((s) => s.kind === 'learning')).toBe(true);
    // Every day of the month lands on some sheet, in order, none duplicated.
    const days = sheets.flatMap((s) => s.grid.rowKeys);
    expect(days).toHaveLength(31);
    expect(new Set(days).size).toBe(31);
  });
});

describe('buildExportDocument — column parts', () => {
  const t = table('2026-01-01', '2026-02-28', ZMANIM.map((z) => z.key), 'ru');
  const sheets = buildExportDocument(input(t, 'ru'), m);
  const january = sheets.filter((s) => s.startIso.slice(0, 7) === '2026-01');
  const february = sheets.filter((s) => s.startIso.slice(0, 7) === '2026-02');

  it('splits an all-shitot selection into parts instead of shrinking below the floor', () => {
    expect(january.length).toBeGreaterThanOrEqual(2);
    for (const sheet of sheets) {
      expect(sheet.fontPx).toBeGreaterThanOrEqual(MIN_TABLE_FONT_PX);
      expect(sheet.part).toBeLessThanOrEqual(sheet.parts);
    }
  });

  it('splits every month at the same column, so part 2 always holds the same zmanim', () => {
    expect(february.length).toBe(january.length);
    for (let i = 0; i < january.length; i++) {
      expect(february[i].grid.headers).toEqual(january[i].grid.headers);
    }
  });

  it('repeats only the identity column on later parts, and loses no zman column', () => {
    const [first, ...rest] = january;
    for (const part of rest) {
      // The date column leads every part; the events/candles columns do not repeat.
      expect(part.grid.headers[0]).toBe(first.grid.headers[0]);
      expect(part.grid.headers).not.toContain('Holiday / Parsha');
    }
    const zmanHeaders = printHeaders(t.keys, 'ru').map((h) => (h.sub ? `${h.label} · ${h.sub}` : h.label));
    const onParts = january.flatMap((s) => s.grid.headers);
    for (const header of zmanHeaders) expect(onParts).toContain(header);
  });

  it('keeps a base’s opinions together on one part', () => {
    const bases = january.map((s) => new Set(s.grid.groupKeys.filter((g) => g !== null)));
    for (let i = 0; i < bases.length; i++) {
      for (let j = i + 1; j < bases.length; j++) {
        for (const base of bases[i]) expect(bases[j].has(base)).toBe(false);
      }
    }
  });
});

describe('buildExportDocument — learning overflow', () => {
  it('splits a wrap-heavy all-cycles month by height, breaking between weeks, covering every day', () => {
    const t = table('2026-01-01', '2026-01-31', [], 'ru', true);
    const sheets = buildExportDocument(
      input(t, 'ru', { dayColumns: dayColumns().slice(0, 1), learningColumns: learningColumns('ru') }),
      m,
    );
    const days = sheets.flatMap((s) => s.grid.rowKeys);
    expect(days).toHaveLength(31);
    expect(days).toEqual([...days].sort());
    if (sheets.length > 1) {
      // Later sheets start on a Sunday — the week boundary the split honors.
      for (const sheet of sheets.slice(1)) {
        expect(new Date(`${sheet.startIso}T00:00:00Z`).getUTCDay()).toBe(0);
      }
    }
  });
});

describe('buildExportDocument — footnotes', () => {
  // July 2026: 17 Tammuz falls on Thursday July 2 — a fast day with both bookends.
  const t = table('2026-07-01', '2026-07-31', DEFAULT_SELECTION);

  it('rides fast times and the molad in the sheet footnotes, ends labelled per visible opinion', () => {
    const sheets = buildExportDocument(input(t, 'en'), m);
    expect(sheets).toHaveLength(1);
    const fast = sheets[0].footnotes.find((note) => /–/.test(note.text));
    expect(fast).toBeDefined();
    expect(fast!.label).not.toBe('');
    expect(fast!.text).toMatch(/\(op:[a-zA-Z0-9]+\)/);
    expect(sheets[0].footnotes.some((note) => note.label.startsWith('Molad'))).toBe(true);
  });

  it('prints fast footnotes even with every column unchecked, skipping fastless months', () => {
    const bare = table('2026-07-01', '2026-07-31', []);
    const sheets = buildExportDocument(input(bare, 'en', { dayColumns: [] }), m);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].grid.headers).toHaveLength(0);
    expect(sheets[0].footnotes.some((note) => /–/.test(note.text))).toBe(true);
  });

  it('gives a weekly fasts-only selection its sheets: day headers over the fast blocks', () => {
    // Jul 1 2026 is a Wednesday; 17 Tammuz falls Thursday Jul 2. Week two
    // (Jul 5–7) has neither fast nor molad and is skipped.
    const bare = table('2026-07-01', '2026-07-07', []);
    const sheets = buildExportDocument(input(bare, 'en', { dayColumns: [], weekly: true }), m);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].kind).toBe('week');
    expect(sheets[0].startIso).toBe('2026-07-01');
    expect(sheets[0].grid.rows).toHaveLength(0);
    expect(sheets[0].footnotes.some((note) => /–/.test(note.text))).toBe(true);
  });

  it('prints a fasts-only selection: dates alone under the fast footnotes', () => {
    // No zmanim, no learning, no data columns — just the identity column and
    // the fast toggle. The footnotes are the content, so a sheet still prints.
    const bare = table('2026-07-01', '2026-07-31', []);
    const sheets = buildExportDocument(input(bare, 'en', { dayColumns: dayColumns().slice(0, 1) }), m);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].kind).toBe('times');
    expect(sheets[0].footnotes.some((note) => /–/.test(note.text))).toBe(true);
    // But a learning-only export still gets no bare list of dates.
    const learningOnly = table('2026-07-01', '2026-07-31', [], 'en', true);
    const learningSheets = buildExportDocument(
      input(learningOnly, 'en', { dayColumns: dayColumns().slice(0, 1), learningColumns: learningColumns('en') }),
      m,
    );
    expect(learningSheets.every((s) => s.kind === 'learning')).toBe(true);
  });

  it('suppresses the fast lines when the fast toggle is off, keeping the molad', () => {
    const sheets = buildExportDocument(input(t, 'en', { includeFastNotes: false }), m);
    expect(sheets[0].footnotes.some((note) => /–/.test(note.text))).toBe(false);
    expect(sheets[0].footnotes.some((note) => note.label.startsWith('Molad'))).toBe(true);
  });
});

describe('buildExportDocument — weekly sheets', () => {
  const t = table('2026-01-07', '2026-01-16', DEFAULT_SELECTION, 'en', true);
  const sheets = buildExportDocument(
    input(t, 'en', { weekly: true, learningColumns: learningColumns('en') }),
    m,
  );

  it('puts one calendar week per sheet, edges partial', () => {
    // Jan 7 2026 is a Wednesday: Wed–Sat, then Sun–Sat, then Sun–Fri.
    expect(sheets.map((s) => [s.startIso, s.endIso])).toEqual([
      ['2026-01-07', '2026-01-10'],
      ['2026-01-11', '2026-01-16'],
    ]);
    for (const sheet of sheets) {
      expect(sheet.kind).toBe('week');
      // Label column + at most seven days.
      expect(sheet.grid.headers.length).toBeLessThanOrEqual(8);
      expect(sheet.fontPx).toBeGreaterThanOrEqual(MIN_TABLE_FONT_PX);
    }
  });

  it('orders the field rows events → zmanim → learning', () => {
    const labels = sheets[0].grid.rows.map((r) => r[0]);
    const eventsAt = labels.indexOf('Holiday / Parsha');
    const learningAt = labels.findIndex((l) => l === CATALOGS.en.learning.dafYomi);
    const zmanAt = labels.findIndex((l) => l.includes('·') || /Chatzot|Sunrise|Shkia/i.test(l));
    expect(eventsAt).toBeGreaterThanOrEqual(0);
    expect(learningAt).toBeGreaterThan(zmanAt);
    expect(zmanAt).toBeGreaterThan(eventsAt);
  });

  it('heads each day column with its date and Hebrew date', () => {
    const grid = sheets[1].grid;
    expect(grid.headers[1]).toMatch(/Sun/);
    expect(grid.subHeaders[1]).not.toBe('');
  });
});

describe('plain print times', () => {
  it('formats every time without a day-period suffix', () => {
    const t = table('2026-01-01', '2026-01-02', DEFAULT_SELECTION);
    for (const row of t.rows) {
      for (const cell of row.cells) {
        expect(cell).toMatch(/^(\d{1,2}:\d{2}(:\d{2})?|—)$/);
      }
    }
  });
});
