import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import en from '../../../messages/en.json';
import he from '../../../messages/he.json';
import ru from '../../../messages/ru.json';
import { DEFAULT_LOCATION } from '@/lib/location';
import { CONFIGURABLE_ZMANIM, DEFAULT_HIDDEN_ZMANIM, ZMANIM } from '@/lib/zmanim';

import {
  buildExportGrid,
  dayKeys,
  dropEmptyColumns,
  type ExportColumn,
  type ExportHeader,
  fitColumnWeights,
  fitColumnWidths,
  fitFontSize,
  fitRowPadding,
  fitRowsPerPage,
  HEADER_FONT_SCALE,
  headerRuns,
  layoutLegibility,
  MAX_TABLE_FONT_PX,
  MIN_LEGIBLE_PX,
  MIN_TABLE_FONT_PX,
  paginateExportGrid,
  paginateExportSheets,
  transposeExportGrid,
} from './grid';
import { estimateMeasurer } from './measure';
import { CONTENT_HEIGHT_PX, CONTENT_WIDTH_PX, FOOTER_BAND_PX, TITLE_BAND_PX } from './page';
import { buildZmanimTable, dayColumnWeight, pageFootnotes } from './table';

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
  { key: 'dayWithMonth', header: 'Date' },
  { key: 'weekday', header: 'Day' },
  { key: 'hebrewDate', header: 'Hebrew date' },
  { key: 'events', header: 'Holiday / Parsha', fields: ['holiday', 'parsha'] },
  { key: 'candleLighting', header: 'Candle lighting', emphasis: true },
  { key: 'havdalah', header: 'Havdala' },
];

/** Zman headers as the tool builds them: a base with several shitot shares a group. */
function zmanHeaders(keys: string[]): ExportHeader[] {
  const perBase = new Map<string, number>();
  for (const z of ZMANIM) perBase.set(z.base, (perBase.get(z.base) ?? 0) + 1);
  return keys.map((key, i) => {
    const def = ZMANIM.find((z) => z.key === key)!;
    // Real shita captions are short ("8.5°", "72 min") — the raw key is not, and
    // using it here would size the columns far wider than the app ever does.
    return (perBase.get(def.base) ?? 1) > 1 ? { label: def.base, sub: `${i % 9}.5°`, group: def.base } : { label: def.base };
  });
}

interface Catalog {
  zmanim: {
    names: Record<string, string>;
    shitot: Record<string, string>;
    shitotShort: Record<string, string>;
    shitotPrint: Record<string, string>;
  };
}

const CATALOGS = { en, he, ru } as unknown as Record<string, Catalog>;

/** The zmanim the export tool ticks by default — a month of these is the real workload. */
const DEFAULT_SELECTION = CONFIGURABLE_ZMANIM.filter((z) => !DEFAULT_HIDDEN_ZMANIM.includes(z.key)).map((z) => z.key);

/**
 * Zman headers exactly as the PDF builds them: real names and real print shita
 * labels from a catalog, so the fit is measured against the strings that will
 * actually be drawn rather than a synthetic stand-in.
 */
function printHeaders(keys: string[], locale: string): ExportHeader[] {
  const { zmanim } = CATALOGS[locale];
  const perBase = new Map<string, number>();
  for (const z of ZMANIM) perBase.set(z.base, (perBase.get(z.base) ?? 0) + 1);
  return keys.map((key) => {
    const def = ZMANIM.find((z) => z.key === key)!;
    const label = zmanim.names[key].replace(/\s*\([^)]*\)/g, '').trim();
    return (perBase.get(def.base) ?? 1) > 1 ? { label, sub: zmanim.shitotPrint[key], group: def.base } : { label };
  });
}

describe('headerRuns', () => {
  const grid = buildExportGrid(MONTH, [{ key: 'weekday', header: 'Day' }], [
    { label: 'Alot', sub: '90 min', group: 'alot' },
    { label: 'Alot', sub: '72 min', group: 'alot' },
    { label: 'Sunrise' },
  ]);

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
    const same = buildExportGrid(MONTH, [], [{ label: 'Tzeit' }, { label: 'Tzeit' }]);
    expect(headerRuns(same).map((r) => r.span)).toEqual([1, 1]);
  });

  it('marks a run as full only when no column under it carries a shita label', () => {
    const runs = headerRuns(grid);
    expect(runs.find((r) => r.label === 'Sunrise')?.full).toBe(true);
    expect(runs.find((r) => r.label === 'Alot')?.full).toBe(false);
  });
});

describe('fitColumnWeights', () => {
  it('collapses an all-empty column to its header instead of a fixed share', () => {
    // January has no holidays, so an events column limited to `holiday` is
    // empty on every row: it should need no more width than its own caption,
    // rather than the static 2.8 units the Excel writer would give it.
    const empty = (header: string) =>
      fitColumnWeights(buildExportGrid(MONTH, [{ key: 'events', header, fields: ['holiday'] }], []))[0];
    const grid = buildExportGrid(MONTH, [{ key: 'events', header: 'Holiday', fields: ['holiday'] }], []);
    expect(grid.rows.every((r) => r[0] === '')).toBe(true);
    // Collapsed well under the static weight the Excel writer uses…
    expect(empty('Holiday')).toBeLessThan(dayColumnWeight('events'));
    // …and driven purely by the caption, since there is no content to fit.
    expect(empty('Hol')).toBeLessThan(empty('Holiday'));
  });

  it('never sizes a column below its longest header word', () => {
    // A column narrower than one word breaks it mid-word ("Празд/ник"), which
    // is what a purely length-based estimate does to long captions.
    const grid = buildExportGrid(MONTH, [{ key: 'events', header: 'Окончание поста', fields: ['holiday'] }], []);
    expect(fitColumnWeights(grid)[0]).toBeGreaterThanOrEqual(('Окончание'.length * HEADER_FONT_SCALE) / 6);
  });

  it('widens a column that actually holds long text', () => {
    const empty = buildExportGrid(MONTH, [{ key: 'events', header: 'E', fields: ['holiday'] }], []);
    const full = buildExportGrid(MONTH, [{ key: 'events', header: 'E', fields: ['parsha'] }], []);
    expect(fitColumnWeights(full)[0]).toBeGreaterThan(fitColumnWeights(empty)[0]);
  });

  it('splits a spanning header’s width demand across the columns it covers', () => {
    const wide = buildExportGrid(MONTH, [], [{ label: 'A very long base zman name indeed' }]);
    const spanned = buildExportGrid(MONTH, [], [
      { label: 'A very long base zman name indeed', sub: '1', group: 'g' },
      { label: 'A very long base zman name indeed', sub: '2', group: 'g' },
    ]);
    // Printed once over two columns, the long name costs each of them less.
    expect(fitColumnWeights(spanned)[0]).toBeLessThan(fitColumnWeights(wide)[0]);
  });

  it('keeps every column between the legibility floor and its kind’s cap', () => {
    const grid = buildExportGrid(MONTH, PRINT_COLUMNS, zmanHeaders(MONTH.keys));
    fitColumnWeights(grid).forEach((w, i) => {
      expect(w).toBeGreaterThanOrEqual(0.7);
      expect(w).toBeLessThanOrEqual(grid.text[i] ? 3 : 1.8);
    });
  });
});

describe('fitFontSize / fitRowsPerPage', () => {
  it('clamps between the legibility floor and the maximum body size', () => {
    expect(fitFontSize([1])).toBe(MAX_TABLE_FONT_PX);
    expect(fitFontSize(Array.from({ length: 200 }, () => 3))).toBe(MIN_TABLE_FONT_PX);
  });

  it('shrinks monotonically as columns are added', () => {
    const ten = fitFontSize(Array.from({ length: 10 }, () => 1));
    const thirty = fitFontSize(Array.from({ length: 30 }, () => 1));
    const sixty = fitFontSize(Array.from({ length: 60 }, () => 1));
    expect(thirty).toBeLessThanOrEqual(ten);
    expect(sixty).toBeLessThan(thirty);
    expect(sixty).toBeGreaterThanOrEqual(MIN_TABLE_FONT_PX);
  });

  it('fits a full 31-day month on one page at the largest body size', () => {
    expect(fitRowsPerPage(MAX_TABLE_FONT_PX)).toBeGreaterThanOrEqual(31);
  });

  it('never returns more rows than the content box can actually hold', () => {
    // The page is a fixed-size element: rows that don't fit would be cropped by
    // the rasterizer, silently dropping days. Re-derive the drawn height here,
    // at the padding the renderer will actually apply.
    for (const font of [MIN_TABLE_FONT_PX, 8, 9.5, MAX_TABLE_FONT_PX]) {
      const rows = fitRowsPerPage(font);
      const headerPx = font * HEADER_FONT_SCALE * 1.35 * 3 * 2 + 8; // two tiers, up to 3 lines each
      const bodyPx = rows * (font * 1.35 + fitRowPadding(font, rows) * 2);
      expect(headerPx + bodyPx).toBeLessThanOrEqual(CONTENT_HEIGHT_PX - TITLE_BAND_PX - FOOTER_BAND_PX);
    }
  });

  it('spreads rows to fill the sheet when the font is limited by width', () => {
    // A wide selection sets a small font, so 31 days would otherwise occupy a
    // third of the page. Padding takes up the slack rather than leaving a gap.
    const wide = fitRowPadding(MIN_TABLE_FONT_PX, 31);
    const packed = fitRowPadding(MIN_TABLE_FONT_PX, fitRowsPerPage(MIN_TABLE_FONT_PX));
    expect(wide).toBeGreaterThan(packed);
    expect(31 * (MIN_TABLE_FONT_PX * 1.35 + wide * 2)).toBeLessThanOrEqual(
      CONTENT_HEIGHT_PX - TITLE_BAND_PX - FOOTER_BAND_PX,
    );
  });
});

describe('paginateExportGrid', () => {
  it('keeps a modest table on a single page', () => {
    const grid = buildExportGrid(MONTH, [{ key: 'dateLabel', header: 'Date' }], ['Sunrise', 'Sunset']);
    const pages = paginateExportGrid(grid);
    expect(pages).toHaveLength(1);
    expect(pages[0].headers).toEqual(['Date', 'Sunrise', 'Sunset']);
    expect(pages[0].rows).toHaveLength(31);
  });

  it('keeps a whole month of the default selection on one sheet', () => {
    // The regression this redesign exists to prevent: the old fixed weight budget
    // split this across ten pages. The ticks the tool SHIPS with must never band —
    // banding is for selections the reader has deliberately widened.
    const grid = buildExportGrid(MONTH, PRINT_COLUMNS, zmanHeaders(DEFAULT_SELECTION));
    const pages = paginateExportGrid(grid);
    expect(pages).toHaveLength(1);
    expect(pages[0].rows).toHaveLength(31);
    expect(fitFontSize(pages[0].weights)).toBeGreaterThan(MIN_TABLE_FONT_PX);
  });

  it('keeps every day whole within a band, however wide the selection', () => {
    // A selection too wide for one sheet now bands its zmanim across pages rather
    // than being refused. Within a band the rule still holds: every page carries
    // that band's full column set, and the days partition across its pages.
    const many = Array.from({ length: 60 }, (_, i) => `Zman ${i}`);
    const pages = paginateExportGrid(buildExportGrid(MONTH, PRINT_COLUMNS, many));
    const byBand = new Map<string, typeof pages>();
    for (const page of pages) {
      const band = page.headers.join('|');
      byBand.set(band, [...(byBand.get(band) ?? []), page]);
    }
    for (const [band, bandPages] of byBand) {
      const width = bandPages[0].headers.length;
      for (const page of bandPages) {
        expect(page.headers.join('|')).toBe(band);
        expect(page.rows.every((r) => r.length === width)).toBe(true);
      }
      // Every day appears exactly once within the band, in order.
      expect(bandPages.flatMap((p) => p.rowKeys)).toEqual(MONTH.rows.map((r) => r.iso));
    }
  });

  it('holds that invariant across a wide sweep of column shapes', () => {
    const week = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-01-04'),
      end: DateTime.fromISO('2026-01-10'),
      keys: ['sunrise'],
    });
    for (let n = 1; n <= 120; n += 7) {
      for (const width of [3, 8, 20]) {
        const grid = buildExportGrid(
          week,
          [{ key: 'dayWithMonth', header: 'Date' }],
          Array.from({ length: n }, (_, i) => ({ label: 'x'.repeat(width), sub: `${i}` })),
        );
        const pages = paginateExportGrid(grid);
        for (const page of pages) expect(page.headers).toEqual(pages[0].headers);
      }
    }
  });

  it('drops a column that is empty on every row', () => {
    // January has no omer and no fast, so those columns would print a header
    // over 31 blank cells. A "—" is a real answer and must NOT be dropped.
    const grid = buildExportGrid(
      MONTH,
      [
        { key: 'dayWithMonth', header: 'Date' },
        { key: 'omer', header: 'Omer' },
        { key: 'fastStart', header: 'Fast begins' },
      ],
      ['Sunrise'],
    );
    expect(grid.headers).toContain('Omer');
    const [page] = paginateExportGrid(grid);
    expect(page.headers).not.toContain('Omer');
    expect(page.headers).not.toContain('Fast begins');
    expect(page.headers).toContain('Date');

    const dashes = { ...grid, rows: grid.rows.map((r) => [r[0], '—', '', r[3]]) };
    expect(dropEmptyColumns(dashes).headers).toContain('Omer');
  });

  it('rules a line above each Sunday, but never at the top of a page', () => {
    const grid = buildExportGrid(MONTH, [{ key: 'dateLabel', header: 'Date' }], ['Sunrise']);
    const [page] = paginateExportGrid(grid);
    // 2026-01-01 is a Thursday, so the first Sunday is the 4th — row index 3.
    expect(page.weekStarts[0]).toBe(false);
    expect(page.weekStarts[3]).toBe(true);
    expect(page.weekStarts[10]).toBe(true);
    expect(page.weekStarts.filter(Boolean)).toHaveLength(4);
  });

  it('writes the civil month on every row', () => {
    // No row's date depends on reading upwards for context, so a reader landing
    // anywhere on any sheet knows the date outright.
    const quarter = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-01-01'),
      end: DateTime.fromISO('2026-04-30'),
      keys: ['sunrise'],
    });
    const grid = buildExportGrid(quarter, [{ key: 'dayWithMonth', header: 'Date' }], ['Sunrise']);
    const pages = paginateExportGrid(grid);
    expect(pages.length).toBeGreaterThan(1); // 120 days cannot fit one sheet
    const cells = pages.flatMap((p) => p.rows.map((r) => r[0]));
    expect(cells).toEqual(quarter.rows.map((r) => r.dayWithMonth));
    // Every cell carries a number AND a month name, so no bare "1" is ambiguous.
    expect(cells.every((c) => /\d/.test(c) && /\p{L}/u.test(c))).toBe(true);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('sizes the day column for the dated text, not a bare number', () => {
    const twoMonths = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-07-28'),
      end: DateTime.fromISO('2026-08-27'),
      keys: ['sunrise'],
    });
    const grid = buildExportGrid(twoMonths, [{ key: 'dayWithMonth', header: 'D' }], ['Sunrise']);
    const longest = Math.max(...grid.rows.map((r) => r[0].length));
    expect(longest).toBeGreaterThan(2);
    expect(fitColumnWeights(grid)[0]).toBeGreaterThanOrEqual(longest / 6);
  });

  it('uses the locale’s in-date month form, not the standalone one', () => {
    // ru renders the standalone month as "июль" but the in-date form as "июл.";
    // joining a day and a standalone month by hand would print the wrong case
    // and disagree with the range in the page header.
    const july = buildZmanimTable({
      ...BASE_OPTS,
      locale: 'ru',
      start: DateTime.fromISO('2026-07-28'),
      end: DateTime.fromISO('2026-08-27'),
      keys: ['sunrise'],
    });
    expect(july.rows[0].dayWithMonth).toContain('июл.');
    expect(july.rows[0].dayWithMonth).not.toContain('июль');
  });

  it('disambiguates a repeated month name across a multi-year range', () => {
    const twoYears = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-12-01'),
      end: DateTime.fromISO('2027-01-31'),
      keys: ['sunrise'],
    });
    const single = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-01-01'),
      end: DateTime.fromISO('2026-03-31'),
      keys: ['sunrise'],
    });
    // Counted as number groups, not position — locales order day/month/year
    // differently ("Jan 1" in en, "1 янв." in ru).
    const numbers = (s: string) => s.match(/\d+/g) ?? [];
    expect(numbers(twoYears.rows[0].dayWithMonth)).toHaveLength(2); // day + year
    expect(numbers(single.rows[0].dayWithMonth)).toHaveLength(1); // day only
  });

  it('carries the fitted weights onto every page so columns line up across sheets', () => {
    const many = Array.from({ length: 90 }, (_, i) => `Zman ${i}`);
    const grid = buildExportGrid(MONTH, [{ key: 'dayWithMonth', header: 'Date' }], many);
    const pages = paginateExportGrid(grid);
    const dateWidth = new Set(pages.map((p) => p.weights[0]));
    expect(dateWidth.size).toBe(1);
  });
});

describe('print shita labels', () => {
  it('has a print label for every zman, in every locale', () => {
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      const print = messages.zmanim.shitotPrint;
      for (const z of ZMANIM) {
        expect(print, `${locale} is missing ${z.key}`).toHaveProperty(z.key);
      }
      const keys = new Set(ZMANIM.map((z) => z.key));
      for (const key of Object.keys(print)) expect(keys.has(key), `${locale}: stray ${key}`).toBe(true);
    }
  });

  it('keeps the opinions of one base distinguishable', () => {
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      const byBase = new Map<string, string[]>();
      for (const z of ZMANIM) {
        byBase.set(z.base, [...(byBase.get(z.base) ?? []), messages.zmanim.shitotPrint[z.key]]);
      }
      for (const [base, labels] of byBase) {
        if (labels.length < 2) continue;
        expect(new Set(labels).size, `${locale}: ${base} has duplicate print labels`).toBe(labels.length);
      }
    }
  });

  it('sits between the compact and the full label', () => {
    // The tier exists to be *more* legible than the compact code without
    // dragging the full label's qualifiers ("72 min fixed") onto a print sheet.
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      for (const z of ZMANIM) {
        const { shitot, shitotShort, shitotPrint } = messages.zmanim;
        expect(shitotPrint[z.key].length, `${locale}: ${z.key} lost information`).toBeGreaterThanOrEqual(
          shitotShort[z.key].length,
        );
        expect(shitotPrint[z.key].length, `${locale}: ${z.key} exceeds the full label`).toBeLessThanOrEqual(
          shitot[z.key].length,
        );
      }
    }
  });

  it('spells an authority out rather than abbreviating it', () => {
    // The complaint this tier answers: a bare "Tanya" / "Тания" on a printed
    // sheet names nobody. Where the app's full label spells an authority out,
    // the print label must too.
    const AUTHORITIES = ['BaalHatanya', 'MGA', 'GRA', 'tzais72', 'tzais161', 'tzais50', 'AteretTorah'];
    // The catalogs are not consistent about which apostrophe an abbreviation
    // takes — the Hebrew full label spells GRA with an ASCII quote (גר"א) where
    // the compact tiers use a gershayim (גר״א). This test is about the NAME
    // surviving, so compare with the quote marks out of the way.
    const plain = (s: string) => s.replace(/['"׳״’]/g, '');
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      for (const z of ZMANIM) {
        if (!AUTHORITIES.some((a) => z.key.includes(a))) continue;
        const { shitot, shitotPrint } = messages.zmanim;
        // The authority is whatever the full label says before its qualifier.
        const authority = shitot[z.key].split(' · ')[0];
        if (/^[\d.]/.test(authority)) continue; // a numeral, not a name
        expect(plain(shitotPrint[z.key]), `${locale}: ${z.key} drops the authority`).toContain(plain(authority));
      }
    }
  });

  /** A January of `keys`, fitted with the real print headers of `locale`. */
  function printFit(keys: string[], locale: string) {
    const month = buildZmanimTable({
      ...BASE_OPTS,
      locale,
      start: DateTime.fromISO('2026-01-01'),
      end: DateTime.fromISO('2026-01-31'),
      keys,
    });
    const pages = paginateExportGrid(buildExportGrid(month, PRINT_COLUMNS, printHeaders(month.keys, locale)));
    return { pages, fontPx: fitFontSize(pages[0].weights) };
  }

  it('costs the default selection no type size at all', () => {
    // Spelling the shitot out widens every opinion column, and the body font is
    // set by the table's WIDTH — so this is where that cost is capped. At the
    // ticks the tool ships with, there is width to spare in all three
    // languages: the month lands on one sheet at the largest body size.
    for (const locale of Object.keys(CATALOGS)) {
      const { pages, fontPx } = printFit(DEFAULT_SELECTION, locale);
      expect(pages, `${locale} split into ${pages.length} pages`).toHaveLength(1);
      expect(pages[0].rows).toHaveLength(31);
      expect(fontPx, `${locale} lost type size to the print labels`).toBe(MAX_TABLE_FONT_PX);
    }
  });

  it('keeps a heavy hand-picked selection legible', () => {
    // Well past the default — eighteen opinions plus the six day columns, which
    // is the shape someone picking several shitot per zman actually gets.
    //
    // Node has no canvas, so this fits through the character ESTIMATE, not the
    // real glyph widths the browser measures; the number is therefore a floor on
    // the fallback rather than a prediction of the printed sheet. What is printed
    // is gated at render time by `layoutLegibility`.
    for (const locale of Object.keys(CATALOGS)) {
      const { pages } = printFit(CONFIGURABLE_ZMANIM.slice(0, 18).map((z) => z.key), locale);
      // However many sheets it takes, each one has to be readable — that is the
      // guarantee banding buys, and it replaces the old flat refusal.
      for (const page of pages) {
        const px = fitFontSize(page.weights);
        expect(px, `${locale} page fell to ${px.toFixed(2)}px`).toBeGreaterThan(7);
      }
    }
  });
});

describe('compact shita labels', () => {
  it('has a short label for every zman, in every locale', () => {
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      const short = messages.zmanim.shitotShort;
      for (const z of ZMANIM) {
        expect(short, `${locale} is missing ${z.key}`).toHaveProperty(z.key);
      }
      // And no strays that no longer map to a zman.
      const keys = new Set(ZMANIM.map((z) => z.key));
      for (const key of Object.keys(short)) expect(keys.has(key), `${locale}: stray ${key}`).toBe(true);
    }
  });

  it('keeps the opinions of one base distinguishable after shortening', () => {
    // Compacting must not collapse two shitot of the same zman into the same
    // caption — the column would then claim a time for an unidentifiable
    // opinion. Checked per base, which is the only place they appear together.
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      const byBase = new Map<string, string[]>();
      for (const z of ZMANIM) {
        byBase.set(z.base, [...(byBase.get(z.base) ?? []), messages.zmanim.shitotShort[z.key]]);
      }
      for (const [base, labels] of byBase) {
        if (labels.length < 2) continue;
        expect(new Set(labels).size, `${locale}: ${base} has duplicate short labels`).toBe(labels.length);
      }
    }
  });

  it('is genuinely shorter than the full label', () => {
    for (const [locale, messages] of Object.entries(CATALOGS)) {
      for (const z of ZMANIM) {
        const full = messages.zmanim.shitot[z.key];
        const short = messages.zmanim.shitotShort[z.key];
        expect(short.length, `${locale}: ${z.key} grew`).toBeLessThanOrEqual(full.length);
      }
    }
  });
});

describe('pageFootnotes', () => {
  const LABELS = {
    ...BASE_OPTS,
    mevarchimLabel: 'Shabbat Mevarchim',
    moladLabel: (p: { weekday: string; time: string; chalakim: number }) =>
      `Molad: ${p.weekday}, ${p.time} and ${p.chalakim} chalakim`,
  };

  it('gives a fast day one line naming the fast and both bookends', () => {
    // 2026-07-02 is 17 Tammuz.
    const t = buildZmanimTable({
      ...LABELS,
      start: DateTime.fromISO('2026-07-02'),
      end: DateTime.fromISO('2026-07-02'),
      keys: ['sunrise'],
    });
    const [line] = pageFootnotes(t.rows, new Set(t.rows.map((r) => r.iso)));
    expect(line).toContain(t.rows[0].holiday);
    expect(line).toContain(t.rows[0].fastStart);
    expect(line).toContain(t.rows[0].fastEnd);
  });

  const JULY = buildZmanimTable({
    ...LABELS,
    start: DateTime.fromISO('2026-07-01'),
    end: DateTime.fromISO('2026-07-31'),
    keys: ['sunrise'],
  });
  const all = new Set(JULY.rows.map((r) => r.iso));
  const fastLines = (page: ReadonlySet<string>) => pageFootnotes(JULY.rows, page).filter((l) => l.includes(' – '));

  it('gives two lines when both summer fasts land on one page', () => {
    // 17 Tammuz (2026-07-02) and Tisha b'Av (2026-07-22 eve → 07-23) share July.
    expect(fastLines(all)).toHaveLength(2);
  });

  it('folds an evening-to-nightfall fast into one named line', () => {
    // Tisha b'Av starts 2026-07-22 at sunset and ends 07-23 at nightfall. The
    // erev row has the time but no name; the fast day has the name but no start.
    const eve = JULY.rows.find((r) => r.iso === '2026-07-22')!;
    const day = JULY.rows.find((r) => r.iso === '2026-07-23')!;
    expect(eve.holiday).toBe('');
    expect(day.fastStart).toBe('');
    const [line] = fastLines(all).filter((l) => l.includes(day.holiday));
    expect(line).toBe(`${day.holiday}: ${eve.fastStart} – ${day.fastEnd}`);
    // …and never a bare, unlabelled time from the erev row on its own.
    expect(fastLines(all).some((l) => l === eve.fastStart)).toBe(false);
  });

  it('shows a split fast on both of the pages it touches, not neither', () => {
    // A page break between the eve and the fast day must not lose the fast.
    const upToEve = new Set(['2026-07-22']);
    const fromFastDay = new Set(['2026-07-23']);
    expect(fastLines(upToEve)).toHaveLength(1);
    expect(fastLines(fromFastDay)).toHaveLength(1);
    expect(fastLines(upToEve)[0]).toBe(fastLines(fromFastDay)[0]);
  });

  it('lists only the fasts on the page in question', () => {
    const firstTen = new Set(JULY.rows.slice(0, 10).map((r) => r.iso));
    expect(fastLines(firstTen)).toHaveLength(1);
    expect(fastLines(new Set(JULY.rows.slice(10, 20).map((r) => r.iso)))).toHaveLength(0);
  });

  it('names the INCOMING month and dates the announcement', () => {
    // A molad announced during Tammuz is Av's, and the footer is detached from
    // any row — so a bare weekday would not say which Tuesday, nor which month.
    const july = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-07-01'),
      end: DateTime.fromISO('2026-07-31'),
      keys: ['sunrise'],
      mevarchimLabel: 'Shabbat Mevarchim',
      moladLabel: (p) => `${p.month}|${p.weekday}|${p.date}|${p.time}|${p.chalakim}`,
    });
    const announcement = july.rows.find((r) => r.molad)!;
    const [month, weekday, date] = announcement.molad.split('|');
    // Announced in Tammuz, for Av — not the month the row itself sits in.
    expect(announcement.hebrewDate).toContain('Tammuz');
    expect(month).toBe('Av');
    expect(weekday).not.toBe('');
    expect(date).toMatch(/\d/); // an actual date, not just a weekday
  });

  it('announces one molad once, though two days carry it', () => {
    // getDayInfo attaches the same molad to Shabbat Mevarchim AND to Rosh
    // Chodesh, so a full month yields the identical sentence twice.
    const molads = pageFootnotes(JULY.rows, all).filter((l) => l.startsWith('Molad'));
    expect(JULY.rows.filter((r) => r.molad).length).toBeGreaterThan(molads.length);
    expect(new Set(molads).size).toBe(molads.length);
  });

  it('announces the molad, and only on the days that carry one', () => {
    const august = buildZmanimTable({
      ...LABELS,
      start: DateTime.fromISO('2026-08-01'),
      end: DateTime.fromISO('2026-08-31'),
      keys: ['sunrise'],
    });
    const molads = pageFootnotes(august.rows, new Set(august.rows.map((r) => r.iso))).filter((l) => l.startsWith('Molad'));
    expect(molads.length).toBeGreaterThan(0);
    // One line per DISTINCT announcement, and only announcement days carry one.
    expect(molads).toEqual([...new Set(august.rows.map((r) => r.molad).filter(Boolean))]);
    expect(august.rows.filter((r) => r.molad).length).toBeLessThan(august.rows.length);
  });

  it('spells Shabbat Mevarchim out for the merged events cell', () => {
    const august = buildZmanimTable({
      ...LABELS,
      start: DateTime.fromISO('2026-08-01'),
      end: DateTime.fromISO('2026-08-31'),
      keys: ['sunrise'],
    });
    const mev = august.rows.find((r) => r.mevarchim === '✓');
    expect(mev?.mevarchimName).toBe('Shabbat Mevarchim');
    expect(august.rows.find((r) => r.mevarchim === '')?.mevarchimName).toBe('');
  });
});

describe('fitColumnWidths', () => {
  it('gives every column its padding before dividing the rest', () => {
    // The bug this replaced: sharing the FULL width by weight charged each
    // column padding in proportion to its weight, so a narrow time column beside
    // wide text columns got less than its 4px and truncated its clock time.
    const weights = [5, 4.6, 1, 1, 1, 1];
    const widths = fitColumnWidths(weights);
    const total = weights.reduce((s, w) => s + w, 0);
    const textSpace = CONTENT_WIDTH_PX - 4 * weights.length;
    widths.forEach((fraction, i) => {
      const px = fraction * CONTENT_WIDTH_PX;
      // Its own padding, plus exactly its share of what's left for text.
      expect(px).toBeCloseTo(4 + (weights[i] / total) * textSpace, 5);
    });
  });

  it('adds up to the full content width', () => {
    for (const weights of [[1], [1, 1, 1], [5, 1, 0.7, 3, 1.8]]) {
      const sum = fitColumnWidths(weights).reduce((s, f) => s + f, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('never gives a narrow column less room than an equal-weight neighbour', () => {
    const widths = fitColumnWidths([5, 1, 1, 4.6, 1]);
    expect(widths[1]).toBeCloseTo(widths[2], 9);
    expect(widths[1]).toBeCloseTo(widths[4], 9);
  });
});

describe('layoutLegibility', () => {
  /**
   * `n` time columns with their fitted weights, WITHOUT paginating — the paginator
   * now bands an illegible column set into legible pages, so asking it for the
   * unfittable case returns the fixed one.
   */
  const pageOf = (n: number) => {
    const grid = buildExportGrid(
      MONTH,
      [{ key: 'dayWithMonth', header: 'Date' }],
      Array.from({ length: n }, (_, i) => ({ label: 'Zman', sub: `${i % 9}.5°`, group: `base${Math.floor(i / 3)}` })),
    );
    return { ...grid, weights: fitColumnWeights(grid) };
  };

  it('passes a selection that prints at a readable size', () => {
    const verdict = layoutLegibility(pageOf(10));
    expect(verdict.legible).toBe(true);
    expect(verdict.smallestPx).toBeGreaterThanOrEqual(MIN_LEGIBLE_PX);
  });

  it('fails once the type is driven below the floor', () => {
    // Enough columns that the width-driven font collapses.
    const verdict = layoutLegibility(pageOf(90));
    expect(verdict.legible).toBe(false);
    expect(verdict.smallestPx).toBeLessThan(MIN_LEGIBLE_PX);
  });

  it('judges by the opinion tier when there is one, else by the names', () => {
    const withOpinions = layoutLegibility(pageOf(10));
    expect(withOpinions.smallestPx).toBeCloseTo(withOpinions.subPx, 9);
    // No opinions anywhere: the names are then the smallest text on the sheet.
    const plain = paginateExportGrid(
      buildExportGrid(MONTH, [{ key: 'dayWithMonth', header: 'Date' }], ['Sunrise', 'Sunset']),
    )[0];
    expect(layoutLegibility(plain).smallestPx).toBeCloseTo(layoutLegibility(plain).namePx, 9);
  });

  it('gets stricter as columns are added, never looser', () => {
    let previous = Infinity;
    for (const n of [5, 10, 20, 40, 80]) {
      const { smallestPx } = layoutLegibility(pageOf(n));
      expect(smallestPx).toBeLessThanOrEqual(previous);
      previous = smallestPx;
    }
  });
});

describe('transposeExportGrid', () => {
  const monthDays = MONTH.rows.map((r) => r.dayWithMonth);

  it('lets the label column outgrow the normal text cap', () => {
    // Transposed, the first column holds each row's WHOLE identity and is the
    // only place it appears. Capped at a text column's 3 units it truncated to
    // "Zman Shma · M…", defeating the layout that exists to give it room.
    const grid = buildExportGrid(MONTH, [], [
      { label: 'Latest Shema', sub: 'Magen Avraham 72 min as 16.1°', group: 'shma' },
      { label: 'Latest Shema', sub: 'Baal HaTanya', group: 'shma' },
    ]);
    const flipped = transposeExportGrid(grid, '', monthDays);
    const weights = fitColumnWeights(flipped);
    expect(flipped.maxWeights[0]).toBeGreaterThan(3);
    expect(weights[0]).toBeGreaterThan(3);
    // Day columns get a ceiling above a tabular column's 1.8 too, because a prose
    // row's longest word has to fit INSIDE one — at 1.8 a Russian "освящения"
    // broke mid-word. Banding, not truncation, absorbs the cost.
    expect(flipped.maxWeights.slice(1).every((w) => w > 1.8)).toBe(true);
  });

  it('is a real escape hatch: it reads larger than the upright sheet', () => {
    // Why the dialog offers transposing when a selection overflows. Asserted as a
    // comparison rather than against an absolute px floor, because Node fits
    // through the character estimate — the ordering holds under either measurer,
    // the absolute numbers do not.
    const wide = buildExportGrid(MONTH, PRINT_COLUMNS, zmanHeaders(MONTH.keys.slice(0, 40)));
    const upright = paginateExportGrid(wide)[0];
    const pages = paginateExportGrid(transposeExportGrid(wide, '', monthDays));
    expect(layoutLegibility(pages[0]).smallestPx).toBeGreaterThan(layoutLegibility(upright).smallestPx);
  });

  it('bands the days across pages without losing or repeating one', () => {
    // Transposed, a column is a DAY, so banding divides by date — every day still
    // gets its whole column on one sheet. That only holds if the bands partition
    // the days exactly.
    const wide = buildExportGrid(MONTH, PRINT_COLUMNS, zmanHeaders(MONTH.keys.slice(0, 40)));
    const pages = paginateExportGrid(transposeExportGrid(wide, '', monthDays));
    // Every page repeats the label column, so a band is readable on its own.
    for (const page of pages) expect(page.headers[0]).toBe('');
    const seen = pages.flatMap((page) => page.headers.slice(1));
    // Row pagination repeats a band's headers across its own pages — count each
    // distinct day once.
    expect([...new Set(seen)].sort()).toEqual([...monthDays].sort());
  });

  it('leaves an upright sheet whole when it fits', () => {
    // Banding is a last resort, not the normal path: a selection that prints on one
    // sheet keeps every column on every page.
    const modest = buildExportGrid(MONTH, PRINT_COLUMNS, zmanHeaders(MONTH.keys.slice(0, 6)));
    const pages = paginateExportGrid(modest);
    const expected = dropEmptyColumns(modest).headers;
    for (const page of pages) expect(page.headers).toEqual(expected);
  });
});

describe('wrapping prose cells', () => {
  /**
   * A transposed month whose prose row holds genuinely MULTI-WORD values
   * ("1 Jan · 12 Tevet · Thu"). A single-word parsha would make the
   * longest-word rule indistinguishable from measuring the whole cell.
   */
  // A 24-hour locale on purpose. In `en` a time prints "4:23 AM", which is itself
  // the widest thing in a day column, so the prose row never dominates and the
  // rule has little to give back. Russian prints "4:23", which is the shape the
  // browser measurements were taken against.
  const RU_MONTH = buildZmanimTable({
    ...BASE_OPTS,
    locale: 'ru',
    start: DateTime.fromISO('2026-01-01'),
    end: DateTime.fromISO('2026-01-31'),
    keys: ZMANIM.map((z) => z.key),
  });

  const flipped = () => {
    const grid = buildExportGrid(
      RU_MONTH,
      [{ key: 'dayWithMonth', header: 'Date', fields: ['dayWithMonth', 'hebrewDate', 'weekday'] }],
      RU_MONTH.keys.slice(0, 20).map(() => ({ label: 'Zman', sub: '8.5' })),
    );
    return transposeExportGrid(grid, '', RU_MONTH.rows.map((r) => r.dayWithMonth));
  };

  it('marks exactly the former text columns as prose rows', () => {
    // Structural, not sniffed: a transposed row IS an original column, so its
    // kind is known exactly.
    const grid = buildExportGrid(MONTH, [{ key: 'events', header: 'H', fields: ['parsha'] }], ['Sunrise']);
    const t = transposeExportGrid(grid, '', MONTH.rows.map((r) => r.dayWithMonth));
    expect(t.proseRows).toEqual([true, false]);
  });

  it('sizes a wrapping column by its longest word, not its longest cell', () => {
    // One "1 Jan · 12 Tevet · Thu" in a single day's column otherwise forces EVERY
    // day column to its cap, and a month of those drags the sheet's type to the
    // legibility floor.
    const grid = flipped();
    const wrapped = fitColumnWeights(grid, estimateMeasurer);
    const whole = fitColumnWeights({ ...grid, proseRows: undefined }, estimateMeasurer);
    expect(wrapped.slice(1).reduce((s, w) => s + w, 0)).toBeLessThan(whole.slice(1).reduce((s, w) => s + w, 0));
    // The label column is untouched — it has its own budget and is measured whole.
    expect(wrapped[0]).toBeCloseTo(whole[0], 9);
  });

  it('buys back a material amount of width, not a rounding error', () => {
    // The payoff, stated clamp-free: fitFontSize saturates at its floor for a
    // month and at its cap for a short range, so asserting a px difference needs
    // a magic range. The width demand is what the font is derived from.
    const grid = flipped();
    const wrapped = fitColumnWeights(grid, estimateMeasurer).slice(1).reduce((s, w) => s + w, 0);
    const whole = fitColumnWeights({ ...grid, proseRows: undefined }, estimateMeasurer)
      .slice(1)
      .reduce((s, w) => s + w, 0);
    expect(wrapped).toBeLessThan(whole * 0.9);
  });

  it('would have wrapped an English clock time — and doesn’t, because the flag is structural', () => {
    // The danger is shown with an English time, which carries "AM"/"PM" and so
    // would fool any has-letters check into wrapping it.
    const enGrid = transposeExportGrid(
      buildExportGrid(MONTH, [{ key: 'events', header: 'H', fields: ['parsha'] }], MONTH.keys.map(() => ({ label: 'Z' }))),
      '',
      MONTH.rows.map((r) => r.dayWithMonth),
    );
    const enTimeRow = enGrid.proseRows!.findIndex((prose) => !prose);
    expect(enGrid.rows[enTimeRow][1]).toMatch(/\p{L}/u);
    const oneRow = (prose: boolean) =>
      fitColumnWeights({ ...enGrid, rows: [enGrid.rows[enTimeRow]], proseRows: [prose] }, estimateMeasurer)[1];
    // Treated as prose the column would be sized for "4:23" alone, and the "AM"
    // would drop to a second line where it reads as a separate value.
    expect(oneRow(true)).toBeLessThan(oneRow(false));
    // Which is why the real grid marks this row as times, not prose.
    expect(enGrid.proseRows![enTimeRow]).toBe(false);
  });
});

describe('paginating wrapped rows', () => {
  /** A transposed month whose prose rows wrap to several lines each. */
  const wrapped = () => {
    const long = buildZmanimTable({
      ...BASE_OPTS,
      locale: 'ru',
      start: DateTime.fromISO('2026-07-30'),
      end: DateTime.fromISO('2026-08-29'),
      keys: ZMANIM.map((z) => z.key).slice(0, 20),
    });
    const grid = buildExportGrid(
      long,
      [
        { key: 'events', header: 'Праздник / глава', fields: ['holiday', 'parsha', 'mevarchimName'] },
        { key: 'dayWithMonth', header: 'Дата', fields: ['dayWithMonth', 'hebrewDate', 'weekday'] },
      ],
      long.keys.map(() => ({ label: 'Zman', sub: '8.5' })),
    );
    return transposeExportGrid(grid, '', long.rows.map((r) => r.dayWithMonth));
  };

  it('never lets a page overflow the paper', () => {
    // The bug: rows-per-page was computed from a UNIFORM row height, so a sheet of
    // three- and four-line learning rows was counted as fitting, reported "1 / 1",
    // and clipped everything past the page edge.
    const pages = paginateExportGrid(wrapped(), estimateMeasurer);
    for (const page of pages) {
      const fontPx = fitFontSize(page.weights, estimateMeasurer);
      const used = (page.lineTotal ?? page.rows.length) * fontPx * 1.35 + page.rows.length * 4;
      const budget = CONTENT_HEIGHT_PX - TITLE_BAND_PX - FOOTER_BAND_PX;
      expect(used, `${page.rows.length} rows over budget`).toBeLessThanOrEqual(budget);
    }
  });

  it('records the line total so row padding cannot re-overflow the page', () => {
    const pages = paginateExportGrid(wrapped(), estimateMeasurer);
    const multi = pages.find((p) => (p.lineTotal ?? 0) > p.rows.length);
    expect(multi, 'expected at least one page with a wrapped row').toBeDefined();
    // Padding is spent per line, not per row: fed the row count it would spread a
    // page of four-line rows straight off the sheet.
    expect(fitRowPadding(8, multi!.rows.length, multi!.lineTotal)).toBeLessThanOrEqual(
      fitRowPadding(8, multi!.rows.length),
    );
  });

  it('balances rows across a band instead of stranding an orphan', () => {
    // Greedy filling produced 31 rows and then a single row on a sheet of its own.
    const pages = paginateExportGrid(wrapped(), estimateMeasurer);
    const byBand = new Map<string, number[]>();
    for (const page of pages) {
      const band = page.headers.join('|');
      byBand.set(band, [...(byBand.get(band) ?? []), page.rows.length]);
    }
    for (const [, counts] of byBand) {
      if (counts.length < 2) continue;
      // No page carries less than a quarter of the fullest one in its band.
      expect(Math.min(...counts) * 4).toBeGreaterThanOrEqual(Math.max(...counts));
    }
  });
});

describe('banding days by week', () => {
  /** A transposed month heavy enough to force banding (all the learning prose). */
  const heavy = () => {
    const month = buildZmanimTable({
      ...BASE_OPTS,
      locale: 'ru',
      // A Thursday start, so the first week is partial; and a range long enough
      // that banding is forced under the character estimate Node fits with, not
      // only under the browser's real glyph widths.
      start: DateTime.fromISO('2026-07-30'),
      end: DateTime.fromISO('2026-09-30'),
      keys: ZMANIM.map((z) => z.key).slice(0, 20),
    });
    const grid = buildExportGrid(
      month,
      [
        { key: 'events', header: 'Праздник / глава', fields: ['holiday', 'parsha', 'mevarchimName'] },
        { key: 'dayWithMonth', header: 'Дата', fields: ['dayWithMonth', 'hebrewDate', 'weekday'] },
      ],
      month.keys.map(() => ({ label: 'Zman', sub: '8.5' })),
    );
    return { grid: transposeExportGrid(grid, '', month.rows.map((r) => r.dayWithMonth)), month };
  };

  it('carries the per-day week flags through the pivot', () => {
    const { grid, month } = heavy();
    // Per-ROW in the upright grid, per-COLUMN once pivoted, with the label column
    // leading and never a week start.
    expect(grid.columnWeekStarts?.[0]).toBe(false);
    expect(grid.columnWeekStarts?.slice(1)).toEqual(month.rows.map((r) => isSunday(r.iso)));
  });

  it('starts every band but the first on a week boundary', () => {
    // A luach is read by the week, so a band that begins mid-week is wrong even
    // when it is legible. The first band may open mid-week: that's where the
    // requested range starts.
    const { grid } = heavy();
    const pages = paginateExportGrid(grid, estimateMeasurer);
    const bands = [...new Set(pages.map((p) => p.headers.join('|')))];
    expect(bands.length).toBeGreaterThan(1);
    for (const band of bands.slice(1)) {
      const page = pages.find((p) => p.headers.join('|') === band)!;
      // The band's first day column is flagged as opening a week.
      expect(page.columnWeekStarts?.[1], `band "${page.headers[1]}" opens mid-week`).toBe(true);
    }
  });

  it('keeps whole weeks together — no week split across bands', () => {
    const { grid } = heavy();
    const pages = paginateExportGrid(grid, estimateMeasurer);
    const bands = [...new Set(pages.map((p) => p.headers.join('|')))].map(
      (b) => pages.find((p) => p.headers.join('|') === b)!,
    );
    // Every band holds a whole number of weeks, save a partial one at each end of
    // the requested range.
    for (const band of bands.slice(1, -1)) {
      const days = band.headers.length - 1;
      expect(days % 7, `band of ${days} days is not whole weeks`).toBe(0);
    }
  });
});

/** Sunday check mirroring the grid's own, for the flag assertion above. */
function isSunday(iso: string): boolean {
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
}

describe('an upright sheet is never split by column', () => {
  it('keeps every zman on every page, however wide the selection', () => {
    // The one thing the sheet must never do: leave a date's times spread over two
    // pages. However many columns are asked for, an upright grid divides by ROWS
    // only — the wide case is handled by turning the sheet, in the export tool.
    for (const n of [6, 20, 40, ZMANIM.length]) {
      const grid = buildExportGrid(MONTH, PRINT_COLUMNS, zmanHeaders(MONTH.keys.slice(0, n)));
      const expected = dropEmptyColumns(grid).headers;
      const pages = paginateExportGrid(grid, estimateMeasurer);
      for (const page of pages) {
        expect(page.headers, `${n} zmanim banded by column`).toEqual(expected);
      }
      // And every day appears exactly once across those pages.
      expect(pages.flatMap((p) => p.rowKeys)).toEqual(MONTH.rows.map((r) => r.iso));
    }
  });

  it('reports the wide case as illegible so the tool knows to turn it', () => {
    // paginateExportGrid can't fix an over-wide upright sheet, so it must not
    // pretend to: layoutLegibility is what tells the export tool to transpose.
    const wide = buildExportGrid(MONTH, PRINT_COLUMNS, zmanHeaders(MONTH.keys));
    const fitted = { ...wide, weights: fitColumnWeights(wide, estimateMeasurer) };
    expect(layoutLegibility(fitted, estimateMeasurer).legible).toBe(false);

    const modest = buildExportGrid(MONTH, PRINT_COLUMNS, zmanHeaders(DEFAULT_SELECTION));
    const okFit = { ...modest, weights: fitColumnWeights(modest, estimateMeasurer) };
    expect(layoutLegibility(okFit, estimateMeasurer).legible).toBe(true);
  });
});

describe('stacked sheets', () => {
  /** A wide upright month: every zman plus all seven learning cycles. */
  const wide = () => {
    const month = buildZmanimTable({
      ...BASE_OPTS,
      locale: 'ru',
      start: DateTime.fromISO('2026-08-02'), // a Sunday: whole weeks throughout
      end: DateTime.fromISO('2026-08-29'),
      // Wide enough to force stacking, but measured through the character
      // ESTIMATE Node fits with — which over-measures, so a fixture heavy enough
      // to stack in the browser cannot fit here at all.
      keys: CONFIGURABLE_ZMANIM.slice(0, 26).map((z) => z.key),
      learningKeys: ['dafYomi'],
    });
    return buildExportGrid(
      month,
      [
        { key: 'dayWithMonth', header: 'Дата', fields: ['dayWithMonth', 'hebrewDate', 'weekday'], maxWeight: 4.6, identity: true },
        { key: 'events', header: 'Праздник / глава', fields: ['holiday', 'parsha'], maxWeight: 5 },
        { key: 'candleLighting', header: 'Свечи', emphasis: true },
        { key: 'dafYomi', header: 'Даф йоми' },
      ],
      printHeaders(month.keys, 'ru'),
    );
  };

  it('stacks a selection too wide for one row of columns', () => {
    const sheets = paginateExportSheets(wide(), estimateMeasurer);
    expect(sheets.length).toBeGreaterThan(0);
    expect(sheets[0].blocks.length).toBeGreaterThan(1);
  });

  it('repeats the date and nothing else', () => {
    // The bug: repeating ALL the day columns printed seven learning readings in
    // every block — duplicated data, and it ate the width stacking exists to buy.
    const sheets = paginateExportSheets(wide(), estimateMeasurer);
    for (const sheet of sheets) {
      const counts = new Map<string, number>();
      for (const block of sheet.blocks) {
        for (const header of block.headers) counts.set(header, (counts.get(header) ?? 0) + 1);
      }
      const repeated = [...counts].filter(([, n]) => n > 1).map(([h]) => h);
      expect(repeated).toEqual(['Дата']);
    }
  });

  it('prints every column exactly once, the date aside', () => {
    const grid = wide();
    const sheets = paginateExportSheets(grid, estimateMeasurer);
    const expected = dropEmptyColumns(grid).headers.filter((h) => h !== 'Дата');
    const printed = sheets[0].blocks.flatMap((b) => b.headers.filter((h) => h !== 'Дата'));
    expect([...printed].sort()).toEqual([...expected].sort());
  });

  it('never wraps the identity column', () => {
    // Wrapping it put "5 Aug · 22 Av · Wed" on three lines, inflating every row and
    // costing the page a third of its days.
    const sheets = paginateExportSheets(wide(), estimateMeasurer);
    for (const block of sheets[0].blocks) {
      expect(block.wrapTextColumns).toBe(true);
      expect(block.keyColumns).toBe(1);
      // Its demand is the whole string, so it is never narrower than one.
      const whole = block.rows.reduce((max, row) => Math.max(max, estimateMeasurer.width(row[0], 10)), 0);
      const unit = estimateMeasurer.width('10:07', 10);
      expect(block.weights[0]).toBeGreaterThanOrEqual(Math.min(whole / unit, 4.6) - 0.01);
    }
  });

  it('keeps whole days together: each block covers the same rows', () => {
    for (const sheet of paginateExportSheets(wide(), estimateMeasurer)) {
      const keys = sheet.blocks.map((b) => b.rowKeys.join('|'));
      expect(new Set(keys).size, 'blocks disagree on which days they show').toBe(1);
    }
  });

  it('leaves a sheet that fits as a single block', () => {
    const month = buildZmanimTable({
      ...BASE_OPTS,
      start: DateTime.fromISO('2026-08-02'),
      end: DateTime.fromISO('2026-08-29'),
      keys: DEFAULT_SELECTION,
    });
    const grid = buildExportGrid(month, PRINT_COLUMNS, zmanHeaders(month.keys));
    for (const sheet of paginateExportSheets(grid, estimateMeasurer)) {
      expect(sheet.blocks).toHaveLength(1);
    }
  });
});

describe('day keys across the pivot', () => {
  // Long enough to band under the character estimate Node fits with, and given a
  // moladLabel — without one buildZmanimTable leaves every row's molad empty, so
  // there would be no footnote to place.
  const month = () =>
    buildZmanimTable({
      ...BASE_OPTS,
      locale: 'ru',
      start: DateTime.fromISO('2026-08-02'),
      end: DateTime.fromISO('2026-10-03'),
      keys: ZMANIM.map((z) => z.key).slice(0, 20),
      moladLabel: ({ month, weekday, date, time }) => `Молад ${month}: ${weekday}, ${date}, ${time}`,
    });

  it('reads the days off the rows when upright', () => {
    const table = month();
    const grid = buildExportGrid(table, [{ key: 'dayWithMonth', header: 'Дата' }], ['Sunrise']);
    expect(dayKeys(grid)).toEqual(table.rows.map((r) => r.iso));
  });

  it('reads them off the columns when transposed', () => {
    // The pivot empties rowKeys — rows are fields there — so without the column
    // axis a transposed page cannot say which days it holds, and every fast
    // bookend and molad line silently vanished.
    const table = month();
    const grid = buildExportGrid(table, [{ key: 'dayWithMonth', header: 'Дата' }], ['Sunrise']);
    const flipped = transposeExportGrid(grid, '', table.rows.map((r) => r.dayWithMonth));
    expect(flipped.rowKeys.every((k) => k === '')).toBe(true);
    expect(dayKeys(flipped)).toEqual(table.rows.map((r) => r.iso));
  });

  it('gives each transposed band only its own days', () => {
    // Banding splits the days across sheets, so the footer of one band must not
    // announce another band's molad.
    const table = month();
    const grid = buildExportGrid(
      table,
      [
        { key: 'dayWithMonth', header: 'Дата', fields: ['dayWithMonth', 'hebrewDate', 'weekday'] },
        { key: 'events', header: 'Праздник / глава', fields: ['holiday', 'parsha', 'mevarchimName'] },
      ],
      table.keys.map(() => ({ label: 'Zman', sub: '8.5' })),
    );
    const pages = paginateExportGrid(transposeExportGrid(grid, '', table.rows.map((r) => r.dayWithMonth)), estimateMeasurer);
    const bands = [...new Set(pages.map((p) => p.headers.join('|')))].map(
      (b) => pages.find((p) => p.headers.join('|') === b)!,
    );
    expect(bands.length).toBeGreaterThan(1);
    // The bands partition the days, and each one's keys are exactly its columns.
    const all = bands.flatMap((band) => dayKeys(band));
    expect([...all].sort()).toEqual([...table.rows.map((r) => r.iso)].sort());
    for (const band of bands) {
      expect(dayKeys(band)).toHaveLength(band.headers.length - 1);
    }
  });

  it('keys the footnotes to the band, not the whole range', () => {
    const table = month();
    const molad = table.rows.filter((r) => r.molad);
    expect(molad.length, 'fixture has no molad to place').toBeGreaterThan(0);
    const onDay = pageFootnotes(table.rows, new Set([molad[0].iso]));
    const elsewhere = pageFootnotes(
      table.rows,
      new Set(table.rows.filter((r) => !r.molad && !r.fastStart && !r.fastEnd).map((r) => r.iso)),
    );
    expect(onDay.some((line) => line === molad[0].molad)).toBe(true);
    expect(elsewhere.some((line) => line === molad[0].molad)).toBe(false);
  });
});
