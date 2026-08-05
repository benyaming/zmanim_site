/**
 * The PDF document model: which sheets a zmanim export produces and what lands
 * on each. This replaces free-form pagination with a fixed, predictable shape —
 *
 *   for every civil month in the range:
 *     · a TIMES sheet    — day rows × (identity + day events + zman columns)
 *     · a LEARNING sheet — day rows × the selected learning cycles
 *
 * — or, in the weekly layout, one sheet per calendar week with the days across
 * the top and every selected field down the side.
 *
 * The split is the whole design. Clock times are five characters wide, uniform
 * and dense; learning readings ("Законы о нанесении ущерба человеку…") are
 * prose. One table holding both starves the times to feed the prose — the state
 * the old export was in. Kept apart, each table has bounded content, so the
 * measuring in grid.ts always finds a readable layout:
 *
 *   · A month is at most 31 rows, which always fits an A4-landscape page, so
 *     vertical pagination of the times sheet effectively does not exist.
 *   · Zman columns are ~1 unit wide, so the body font is essentially
 *     width / column-count; when even the floor size cannot hold every column,
 *     the zmanim split into column PARTS at opinion-group boundaries and the
 *     month prints as "1/2", "2/2" — identity columns repeated on each part.
 *   · Facts that occur once a month (fast bookends, the molad) ride each
 *     sheet's footer, never a column that is blank on 29 rows out of 30.
 */

import {
  buildExportGrid,
  cellValue,
  dropEmptyColumns,
  type ExportColumn,
  type ExportGrid,
  type ExportHeader,
  fitColumnWeights,
  fitFontSize,
  fitRowPadding,
  fitsTextColumn,
  MAX_TABLE_FONT_PX,
  MIN_TABLE_FONT_PX,
  pickColumns,
  rawFontSize,
  rowLineCounts,
  sheetBodyHeight,
  sliceRows,
  tableDemandWidthPx,
  transposeExportGrid,
  WEEK_MAX_FONT_PX,
} from './grid';
import { defaultMeasurer, type TextMeasurer } from './measure';
import { CONTENT_WIDTH_PX } from './page';
import { type PageFootnote, pageFootnotes, type ZmanimTable, type ZmanimTableRow } from './table';

export interface ExportDocumentInput {
  table: ZmanimTable;
  /**
   * The compact day columns, identity (`identity: true`) first — everything the
   * times sheet shows besides the zmanim. Learning cycles do NOT belong here.
   */
  dayColumns: ExportColumn[];
  /** One header per `table.keys` entry, in the same order. */
  zmanHeaders: ExportHeader[];
  /** The selected learning cycles, as columns for the learning sheet. */
  learningColumns: ExportColumn[];
  /** Weekly layout: one calendar week per sheet, days across the top. */
  weekly: boolean;
  /** Include fast start/end footnotes (the "fast times" toggle). Default true. */
  includeFastNotes?: boolean;
}

export interface ExportDocSheet {
  kind: 'times' | 'learning' | 'week';
  /** Fitted grid — weights are final; the renderer derives widths from them. */
  grid: ExportGrid;
  /**
   * A sparse month flowed into side-by-side halves (first half of the month,
   * then the rest), each a row-slice of `grid`. Set only when the columns ask
   * for well under half the page — a one-cycle learning list, a two-zman
   * selection — where one full-width table would be mostly whitespace.
   */
  flowGrids?: ExportGrid[];
  /** Table width per flowed half, in px. */
  flowWidthPx?: number;
  /** Body font size the layout was fitted at. */
  fontPx: number;
  /** Per-side vertical cell padding spending the sheet's leftover height. */
  rowPaddingPx: number;
  /** First and last ISO date on the sheet (equal for a single day). */
  startIso: string;
  endIso: string;
  /** 1-based sheet index within its month (or week) and kind, and the total. */
  part: number;
  parts: number;
  /** Once-a-month facts for the days on this sheet (fasts, molad), as labelled footer blocks. */
  footnotes: PageFootnote[];
}

/** Rendered line height multiplier (must match the page renderer). */
const LINE_HEIGHT = 1.35;
/** Vertical cell padding budgeted per row before slack is distributed. */
const ROW_PADDING_PX = 4;
/** Height of one row of footer blocks (bordered cards under the table). */
const FOOTNOTE_ROW_PX = 36;

/**
 * Footer height the blocks will occupy: about three blocks fit a row, and the
 * ever-present calculation block rides with them (hence +1). Zero blocks cost
 * nothing extra — the calculation line lives inside the base footer band.
 */
function footnoteBandPx(count: number): number {
  return count === 0 ? 0 : Math.ceil((count + 1) / 3) * FOOTNOTE_ROW_PX;
}
/** Gap between the side-by-side halves of a flowed sparse sheet. */
const FLOW_GAP_PX = 32;
/** Don't flow a sheet shorter than this — a handful of rows reads fine as one table. */
const FLOW_MIN_ROWS = 14;
/** A flowed half may stretch this far past its measured demand, and no farther. */
const FLOW_MAX_STRETCH = 1.5;
/** Floor width for a flowed half, so a two-column table doesn't shrink to a sliver. */
const FLOW_MIN_WIDTH_PX = 300;

interface Slice {
  start: number;
  end: number;
}

/** Group day rows by civil month, in range order. */
function monthSlices(rows: ZmanimTableRow[]): Slice[] {
  const slices: Slice[] = [];
  for (let i = 0; i < rows.length; i++) {
    const month = rows[i].iso.slice(0, 7);
    const last = slices[slices.length - 1];
    if (last && rows[last.start].iso.slice(0, 7) === month) last.end = i + 1;
    else slices.push({ start: i, end: i + 1 });
  }
  return slices;
}

/** Row-index groups of calendar weeks (the first/last may be partial). */
function weekSlices(grid: ExportGrid): Slice[] {
  const slices: Slice[] = [];
  grid.rows.forEach((_, row) => {
    const last = slices[slices.length - 1];
    if (last && !grid.weekStarts[row]) last.end = row + 1;
    else slices.push({ start: row, end: row + 1 });
  });
  return slices;
}

/**
 * The zman columns in contiguous units that must not split across parts: a
 * base's opinions stay together (they share a spanning tier-1 header).
 */
function zmanUnits(grid: ExportGrid): number[][] {
  const units: number[][] = [];
  for (let col = grid.leadColumns ?? 0; col < grid.headers.length; col++) {
    const key = grid.groupKeys[col];
    const prev = units[units.length - 1];
    if (prev && key !== null && grid.groupKeys[col - 1] === key) prev.push(col);
    else units.push([col]);
  }
  return units;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/**
 * Split the zman columns into the fewest parts that each print at or above the
 * minimum font, then balance the parts so the last is not a stub. Demands come
 * from the WHOLE table, so every month of the document splits at the same
 * column — page 2 of March holds the same zmanim as page 2 of April.
 *
 * Part 1 carries all the day columns; later parts repeat only the identity
 * columns (the date), because a holiday or a candle-lighting time belongs to
 * exactly one sheet — repeating them would spend the width the split exists to
 * recover.
 */
function partitionColumns(grid: ExportGrid, m: TextMeasurer): number[][] {
  const lead = range(0, grid.leadColumns ?? 0);
  const key = range(0, grid.keyColumns ?? 0);
  const units = zmanUnits(grid);
  if (units.length === 0) return [lead];
  const weights = fitColumnWeights(grid, m);
  const weightOf = (cols: number[]) => sum(cols.map((c) => weights[c]));
  const fits = (repeated: number[], unitCols: number[]) =>
    rawFontSize(
      [...repeated, ...unitCols].map((c) => weights[c]),
      m,
    ) >= MIN_TABLE_FONT_PX;

  // Everything on one sheet is the normal case — check it before any
  // splitting arithmetic.
  const all = units.flat();
  if (fits(lead, all)) return [[...lead, ...all]];

  // Greedy fill fixes the part COUNT: each part takes units until the next one
  // would push it below the floor. Parts after the first repeat only the
  // identity columns, so they have more room.
  const greedy: number[][] = [];
  let current: number[] = [];
  for (const unit of units) {
    const repeated = greedy.length === 0 ? lead : key;
    if (current.length > 0 && !fits(repeated, [...current, ...unit])) {
      greedy.push(current);
      current = [];
    }
    current.push(...unit);
  }
  if (current.length > 0) greedy.push(current);
  if (greedy.length === 1) return [[...lead, ...greedy[0]]];

  // Rebalance to roughly equal width per part — 30+27 columns reads better
  // than 40+17 — keeping the greedy part count. If balancing ever pushes a
  // part below the floor (a huge unit landing awkwardly), keep greedy.
  const target = sum(units.map(weightOf)) / greedy.length;
  const balanced: number[][] = [];
  current = [];
  let used = 0;
  for (const unit of units) {
    const want = weightOf(unit);
    if (current.length > 0 && used + want / 2 > target && balanced.length < greedy.length - 1) {
      balanced.push(current);
      current = [];
      used = 0;
    }
    current.push(...unit);
    used += want;
  }
  if (current.length > 0) balanced.push(current);
  const parts = balanced.every((part, i) => fits(i === 0 ? lead : key, part)) ? balanced : greedy;
  return parts.map((part, i) => [...(i === 0 ? lead : key), ...part]);
}

/** Total rendered height of the rows at this font, given per-row line counts. */
function rowsHeight(lines: number[], fontPx: number): number {
  // +1 per row: the rendered border-top, which the font math otherwise ignores
  // and which adds up to real pixels over thirty rows.
  return sum(lines) * fontPx * LINE_HEIGHT + lines.length * (ROW_PADDING_PX + 1);
}

/**
 * Fit one sheet's font vertically: start from the width-derived size and step
 * down until the rows (with their wrapped lines re-counted per step) fit the
 * body — or the floor is reached. The caller decides what to do when even the
 * floor overflows (split rows across sheets).
 */
function fitSheetFont(
  grid: ExportGrid,
  widthFontPx: number,
  extraFooterPx: number,
  m: TextMeasurer,
): { fontPx: number; lines: number[] } {
  let fontPx = widthFontPx;
  for (;;) {
    const lines = rowLineCounts(grid, grid.weights, fontPx, m);
    const budget = sheetBodyHeight(fontPx, grid, m) - extraFooterPx;
    if (rowsHeight(lines, fontPx) <= budget || fontPx <= MIN_TABLE_FONT_PX) return { fontPx, lines };
    fontPx = Math.max(MIN_TABLE_FONT_PX, fontPx - 0.25);
  }
}

/**
 * Split rows into the fewest height-balanced chunks that each fit a sheet,
 * breaking only at the given boundaries (calendar weeks) where possible.
 * Balanced, not greedy: greedy fill produces "31 rows, then a 2-row orphan
 * sheet". If a boundary-respecting balance leaves an over-tall chunk, the
 * chunk count grows until everything fits.
 */
function splitRowsByHeight(lines: number[], fontPx: number, budget: number, breaks: Slice[]): Slice[] {
  const rowCount = lines.length;
  const heightOf = (s: Slice) => rowsHeight(lines.slice(s.start, s.end), fontPx);
  const total = rowsHeight(lines, fontPx);

  for (let parts = Math.max(1, Math.ceil(total / Math.max(1, budget))); ; parts++) {
    const target = total / parts;
    const slices: Slice[] = [];
    let start = 0;
    let used = 0;
    for (const b of breaks) {
      const height = heightOf(b);
      // Close the slice on the boundary nearest the even share.
      if (b.start > start && used + height / 2 > target && slices.length < parts - 1) {
        slices.push({ start, end: b.start });
        start = b.start;
        used = 0;
      }
      used += height;
    }
    slices.push({ start, end: rowCount });
    if (slices.every((s) => heightOf(s) <= budget) || parts >= breaks.length) return slices;
  }
}

/** Footnotes for the days a grid covers (columns on a weekly sheet, rows otherwise). */
function footnotesFor(table: ZmanimTable, grid: ExportGrid, includeFasts: boolean): PageFootnote[] {
  const keys = grid.columnKeys ?? grid.rowKeys;
  return pageFootnotes(table.rows, new Set(keys.filter((k) => k !== '')), includeFasts);
}

/**
 * Fit one month-part grid and emit its sheet(s): weights and font from THIS
 * month's content (September's holiday names size September's events column,
 * not the whole range's), rows split by height only in the rare case the month
 * cannot hold its wrapped lines (an all-cycles learning sheet in Russian).
 */
function monthSheets(
  kind: 'times' | 'learning',
  input: ExportDocumentInput,
  monthGrid: ExportGrid,
  m: TextMeasurer,
): ExportDocSheet[] {
  const { table } = input;
  const includeFasts = input.includeFastNotes !== false;
  const trimmed = dropEmptyColumns(monthGrid);
  const fitted: ExportGrid = { ...trimmed, weights: fitColumnWeights(trimmed, m) };
  const widthFont = fitFontSize(fitted.weights, m);
  const monthNotes = kind === 'times' ? footnotesFor(table, fitted, includeFasts) : [];
  const { fontPx, lines } = fitSheetFont(fitted, widthFont, footnoteBandPx(monthNotes.length), m);
  const budget = sheetBodyHeight(fontPx, fitted, m) - footnoteBandPx(monthNotes.length);

  const slices =
    rowsHeight(lines, fontPx) <= budget
      ? [{ start: 0, end: fitted.rows.length }]
      : splitRowsByHeight(lines, fontPx, budget, weekSlices(fitted));

  return slices.map((s) => {
    const grid = sliceRows(fitted, s.start, s.end);
    const sliceLines = lines.slice(s.start, s.end);
    const footnotes = kind === 'times' ? footnotesFor(table, grid, includeFasts) : [];
    // A single-slice month may flow into halves; `budget` already accounts for
    // this sheet's footnotes (they equal the month's when nothing was split).
    const flow = slices.length === 1 ? flowSparseSheet(grid, fontPx, budget, m) : null;
    const padRows = flow ? Math.max(...flow.grids.map((g) => g.rows.length)) : grid.rows.length;
    const padLines = flow ? Math.max(...flow.grids.map((g) => g.lineTotal ?? g.rows.length)) : sum(sliceLines);
    return {
      kind,
      grid: { ...grid, lineTotal: sum(sliceLines) },
      flowGrids: flow?.grids,
      flowWidthPx: flow?.widthPx,
      fontPx,
      rowPaddingPx: fitRowPadding(fontPx, padRows, padLines, grid, footnoteBandPx(footnotes.length), m),
      startIso: grid.rowKeys[0] ?? '',
      endIso: grid.rowKeys[grid.rowKeys.length - 1] ?? '',
      part: 1,
      parts: 1,
      footnotes,
    };
  });
}

/**
 * Flow a sparse month into two side-by-side halves — the pocket-luach answer
 * to a two-column table on landscape paper. Applies only when the columns ask
 * for well under half the page at full size; the halves break between weeks,
 * and each half is capped at a modest stretch past its measured demand so the
 * columns stay set rather than dissolving into whitespace.
 */
function flowSparseSheet(
  grid: ExportGrid,
  fontPx: number,
  budgetPx: number,
  m: TextMeasurer,
): { grids: ExportGrid[]; widthPx: number } | null {
  if (grid.rows.length < FLOW_MIN_ROWS || fontPx < MAX_TABLE_FONT_PX) return null;
  const demand = tableDemandWidthPx(grid.weights, fontPx, m);
  if (demand * 2 + FLOW_GAP_PX > CONTENT_WIDTH_PX) return null;

  const widthPx = Math.min((CONTENT_WIDTH_PX - FLOW_GAP_PX) / 2, Math.max(demand * FLOW_MAX_STRETCH, FLOW_MIN_WIDTH_PX));
  // Wrapped lines RE-COUNTED at the half width: a Rambam reading that sat on
  // one line across the full page takes two or three in a half-width column,
  // and cutting by the full-width counts overflowed the page and clipped the
  // month's last days.
  const lines = rowLineCounts(grid, grid.weights, fontPx, m, widthPx);

  // Choose the week boundary whose taller half is shortest; if even that half
  // cannot fit the page, the sheet stays a single table — never clipped.
  const total = rowsHeight(lines, fontPx);
  let cut = 0;
  let best = Infinity;
  for (const week of weekSlices(grid)) {
    if (week.start === 0) continue;
    const left = rowsHeight(lines.slice(0, week.start), fontPx);
    const taller = Math.max(left, total - left);
    if (taller < best) {
      best = taller;
      cut = week.start;
    }
  }
  if (cut === 0 || best > budgetPx) return null;

  const halves = [sliceRows(grid, 0, cut), sliceRows(grid, cut, grid.rows.length)];
  return {
    grids: halves.map((g, i) => ({ ...g, lineTotal: sum(i === 0 ? lines.slice(0, cut) : lines.slice(cut)) })),
    widthPx,
  };
}

/**
 * The weekly layout: one calendar week per sheet. Eight columns at most — the
 * field labels and up to seven days — so the type runs large and prose cells
 * (holidays, learning readings) get real width. Each day column is headed by
 * its date with the Hebrew date beneath. A selection with more field rows than
 * one sheet's height splits across sheets, days repeated on each.
 */
function weeklySheets(input: ExportDocumentInput, m: TextMeasurer): ExportDocSheet[] {
  const { table } = input;
  // Learning readings join the field rows AFTER the zmanim: the sheet reads
  // events → times → study, top to bottom.
  const preColumns = input.dayColumns.filter((c) => c.identity !== true);
  const base = buildExportGrid(table, [...preColumns, ...input.learningColumns], input.zmanHeaders);
  const pre = preColumns.length;
  const learning = input.learningColumns.length;
  const fieldOrder = [...range(0, pre), ...range(pre + learning, base.headers.length), ...range(pre, pre + learning)];

  const sheets: ExportDocSheet[] = [];
  for (const week of calendarWeeks(table.rows)) {
    const days = table.rows.slice(week.start, week.end);
    const turned = transposeExportGrid(
      pickColumns(sliceRows(base, week.start, week.end), fieldOrder),
      '',
      days.map((r) => [r.weekday, r.dayWithMonth].filter(Boolean).join(' ')),
      days.map((r) => r.hebrewDate),
    );
    const trimmed = dropEmptyFieldRows(turned);
    if (trimmed.rows.length === 0) continue;

    // Uniform day columns: each day's width is the widest day's demand, so the
    // seven columns march evenly instead of jittering with their content.
    const measured = fitColumnWeights(trimmed, m);
    const dayMax = Math.max(...measured.slice(1));
    const fitted: ExportGrid = { ...trimmed, weights: [measured[0], ...measured.slice(1).map(() => dayMax)] };

    const footnotes = footnotesFor(table, fitted, input.includeFastNotes !== false);
    // Not fitFontSize: the weekly sheet has its own, higher ceiling — eight
    // wide columns deserve larger type than a month grid ever gets.
    const widthFont = Math.max(MIN_TABLE_FONT_PX, Math.min(WEEK_MAX_FONT_PX, rawFontSize(fitted.weights, m)));
    const { fontPx, lines } = fitSheetFont(fitted, widthFont, footnoteBandPx(footnotes.length), m);
    const budget = sheetBodyHeight(fontPx, fitted, m) - footnoteBandPx(footnotes.length);

    const slices =
      rowsHeight(lines, fontPx) <= budget
        ? [{ start: 0, end: fitted.rows.length }]
        : splitRowsByHeight(
            lines,
            fontPx,
            budget,
            fitted.rows.map((_, i) => ({ start: i, end: i + 1 })),
          );

    slices.forEach((s, i) => {
      const grid = sliceRows(fitted, s.start, s.end);
      const sliceLines = lines.slice(s.start, s.end);
      sheets.push({
        kind: 'week',
        grid: { ...grid, lineTotal: sum(sliceLines) },
        fontPx,
        rowPaddingPx: fitRowPadding(
          fontPx,
          grid.rows.length,
          sum(sliceLines),
          grid,
          footnoteBandPx(footnotes.length),
          m,
        ),
        startIso: days[0]?.iso ?? '',
        endIso: days[days.length - 1]?.iso ?? '',
        part: i + 1,
        parts: slices.length,
        footnotes,
      });
    });
  }
  return sheets;
}

/** Calendar-week slices over the whole table (Sunday-started, edges partial). */
function calendarWeeks(rows: ZmanimTableRow[]): Slice[] {
  const slices: Slice[] = [];
  rows.forEach((row, i) => {
    const weekday = new Date(`${row.iso}T00:00:00Z`).getUTCDay();
    const last = slices[slices.length - 1];
    if (last && weekday !== 0) last.end = i + 1;
    else slices.push({ start: i, end: i + 1 });
  });
  return slices;
}

/** Drop field ROWS that are empty across the whole week (no omer, no candles…). */
function dropEmptyFieldRows(grid: ExportGrid): ExportGrid {
  const keep = grid.rows.map((row) => row.slice(1).some((cell) => (cell ?? '') !== ''));
  if (keep.every(Boolean)) return grid;
  return {
    ...grid,
    rows: grid.rows.filter((_, i) => keep[i]),
    weekStarts: grid.weekStarts.filter((_, i) => keep[i]),
    proseRows: grid.proseRows?.filter((_, i) => keep[i]),
    rowKeys: grid.rowKeys.filter((_, i) => keep[i]),
  };
}

/** Renumber part/parts within each (kind, month) group, in place. */
function numberParts(sheets: ExportDocSheet[]): ExportDocSheet[] {
  const groups = new Map<string, ExportDocSheet[]>();
  for (const sheet of sheets) {
    const key = `${sheet.kind}:${sheet.startIso.slice(0, 7)}`;
    const group = groups.get(key);
    if (group) group.push(sheet);
    else groups.set(key, [sheet]);
  }
  for (const group of groups.values()) {
    group.forEach((sheet, i) => {
      sheet.part = i + 1;
      sheet.parts = group.length;
    });
  }
  return sheets;
}

/**
 * Build the whole document. Sheets come out in reading order: for each month,
 * its times sheet(s) — column parts, then any row splits — followed by its
 * learning sheet(s); or week sheets in the weekly layout.
 */
export function buildExportDocument(input: ExportDocumentInput, m: TextMeasurer = defaultMeasurer()): ExportDocSheet[] {
  const { table } = input;
  if (table.rows.length === 0) return [];
  if (input.weekly) return weeklySheets(input, m);

  const sheets: ExportDocSheet[] = [];
  const months = monthSlices(table.rows);

  // A LONE learning cycle whose values are all short (Daf Yomi, Tehillim)
  // joins the times sheet as its closing column — the myzmanim דף היומי
  // position — instead of spending a whole sheet on one narrow list. Several
  // cycles, or one with spelled-out readings (Rambam), keep their own sheet.
  const lone = input.learningColumns.length === 1 ? input.learningColumns[0] : null;
  const inlineLearning =
    lone && fitsTextColumn(table.rows.map((r) => cellValue(r, lone)), m) ? [{ ...lone, maxWeight: 3 }] : [];

  // The times grid: day columns + zmanim (+ an inlined cycle), long-form
  // learning strictly excluded. Column parts are computed once over the whole
  // table so every month splits alike. A grid whose only columns IDENTIFY the
  // rows carries no data — a learning-only export gets no bare list of dates
  // masquerading as a times sheet.
  const hasTimes =
    input.dayColumns.some((c) => c.identity !== true) || input.zmanHeaders.length > 0 || inlineLearning.length > 0;
  const timesGrid = hasTimes
    ? { ...buildExportGrid(table, input.dayColumns, input.zmanHeaders, inlineLearning), wrapTextColumns: true }
    : null;
  const parts = timesGrid ? partitionColumns(timesGrid, m) : [];

  // The learning grid: the identity columns and the selected cycles, wrapping
  // allowed — a reading is data here, not an intruder, and gets its width.
  const keyColumns = input.dayColumns.filter((c) => c.identity === true);
  const learningGrid =
    input.learningColumns.length > 0 && inlineLearning.length === 0
      ? { ...buildExportGrid(table, [...keyColumns, ...input.learningColumns], []), wrapTextColumns: true }
      : null;

  for (const month of months) {
    if (timesGrid) {
      for (const cols of parts) {
        const monthPart = sliceRows(pickColumns(timesGrid, cols), month.start, month.end);
        sheets.push(...monthSheets('times', input, monthPart, m));
      }
    }
    if (learningGrid) {
      const monthGrid = sliceRows(learningGrid, month.start, month.end);
      sheets.push(...monthSheets('learning', input, monthGrid, m));
    }
  }
  return numberParts(sheets);
}
