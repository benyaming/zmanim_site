import { defaultMeasurer, REFERENCE_FONT_PX, type TextMeasurer } from './measure';
import { CONTENT_HEIGHT_PX, CONTENT_WIDTH_PX, FOOTER_BAND_PX, TITLE_BAND_PX } from './page';
import { dayColumnWeight, type DayColumnKey, TEXT_DAY_COLUMNS, type ZmanimTable, type ZmanimTableRow } from './table';

/** A day-column key that is a real field on `ZmanimTableRow` (everything but the synthetic `events`). */
type RowFieldKey = Exclude<DayColumnKey, 'events'>;

/** A single enabled column: which row field it reads and its localized header. */
export interface ExportColumn {
  key: DayColumnKey;
  header: string;
  /**
   * Opinion / method sub-label, printed in the PDF's second header tier and
   * folded into the flat header ("name · shita") for CSV and Excel.
   */
  sub?: string;
  /** Print this column's non-empty cells bold (candle lighting). */
  emphasis?: boolean;
  /** Widest this column may grow, in weight units. Defaults by column kind. */
  maxWeight?: number;
  /**
   * This column IDENTIFIES the row (the date) rather than carrying data about
   * it. When a wide selection splits into column parts, these are the only
   * columns repeated on every part: a holiday name or a candle time belongs to
   * exactly one sheet, printed once.
   */
  identity?: boolean;
  /**
   * Join these row fields with " · " (dropping empties) instead of reading
   * `key` off the row. Required for the synthetic `events` column, which the
   * PDF uses to merge holiday + parsha into one narrow column.
   */
  fields?: RowFieldKey[];
}

/** A zman column's header: the base zman's name, plus its opinion label when the base has several. */
export interface ExportHeader {
  /** Tier-1 label — the base zman's name ("Alot ha-Shachar"). */
  label: string;
  /** Tier-2 label — this opinion ("90 min fixed"); omitted for single-opinion bases. */
  sub?: string;
  /**
   * Merge identity. Consecutive columns sharing a non-null group render under
   * one spanning tier-1 header, so the base name is printed once instead of
   * repeated on every opinion. Omitted = this column stands alone.
   */
  group?: string;
}

/**
 * A fully materialized table ready for any writer (CSV / Excel / PDF): plain
 * string cells plus per-column print hints. The same shape describes a normal
 * table (one row per day) and a transposed one (one row per field) — writers
 * don't care which, so transpose is a single pivot at this boundary.
 */
export interface ExportGrid {
  /** Flat header per column ("name · shita") — what CSV and Excel write. */
  headers: string[];
  /** PDF tier-1 label per column; consecutive columns sharing a `groupKeys` entry span one header. */
  groupLabels: string[];
  /** PDF tier-2 label per column ('' when the column has no opinion sub-label). */
  subHeaders: string[];
  /** Merge identity for the tier-1 header; null columns never merge with a neighbour. */
  groupKeys: (string | null)[];
  /** Relative print width per column (a zman/time column is the 1.0 unit). */
  weights: number[];
  /** Per-column width ceiling in weight units; 0 = use the default for its kind. */
  maxWeights: number[];
  /** Per column: free text (start-aligned, wider) vs a tabular time/number. */
  text: boolean[];
  /** Per column: print non-empty cells bold. */
  emphasis: boolean[];
  /** Body rows, each aligned to `headers`. */
  rows: string[][];
  /** Per row: this row starts a new week (the PDF rules a line above it). */
  weekStarts: boolean[];
  /**
   * Per ROW: this row holds prose rather than clock times, so its cells may wrap
   * and demand only a fraction of their full width. Set by the transposed layout
   * ONLY, where a row is a former column and its kind is therefore known exactly.
   *
   * Deliberately structural rather than sniffed from the text: an English time
   * prints as "4:23 AM", which contains letters, so a content heuristic would
   * call it prose and break it across two lines — where it reads as two numbers.
   */
  proseRows?: boolean[];
  /** How many leading columns are day columns rather than zmanim. */
  leadColumns?: number;
  /** How many leading columns identify the row (the date) — see `ExportColumn.identity`. */
  keyColumns?: number;
  /**
   * Text columns on this grid may WRAP (to a line cap) rather than truncate,
   * and therefore demand only a fraction of their longest value. On for print
   * grids; off for the flat CSV/Excel grid, where wrapping has no meaning.
   */
  wrapTextColumns?: boolean;
  /**
   * Total wrapped LINES this sheet's rows occupy — set by the document builder;
   * `fitRowPadding` spends leftover height per LINE, and counting rows instead
   * would over-pad a sheet of multi-line rows straight off the paper.
   */
  lineTotal?: number;
  /**
   * Per row: the day's ISO date. Lets the document map a sheet back to the days
   * on it, for footer material (fast times, the molad) that belongs once per
   * sheet rather than in a column of its own.
   */
  rowKeys: string[];
  /**
   * Per COLUMN: the day's ISO date, for the transposed layout where a column IS
   * a day ('' for the label column). `rowKeys` are all '' there — rows are
   * fields — so this is what says which days a weekly sheet holds.
   */
  columnKeys?: string[];
}

/** The cell text for one column of one row (joining `fields` when the column is synthetic). */
function cellValue(row: ZmanimTableRow, column: ExportColumn): string {
  const fields = column.fields ?? (column.key === 'events' ? [] : [column.key]);
  return fields
    .map((f) => row[f])
    .filter(Boolean)
    .join(' · ');
}

/** Flat "name · shita" header, as CSV and Excel have always written it. */
function flatHeader(label: string, sub?: string): string {
  return sub ? `${label} · ${sub}` : label;
}

/** True when the ISO date falls on a Sunday — where a new week block begins. */
function isWeekStart(iso: string): boolean {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).getUTCDay() === 0;
}

/** Build the normal (day-per-row) grid from the table and its enabled columns. */
export function buildExportGrid(
  table: ZmanimTable,
  columns: ExportColumn[],
  zmanHeaders: ReadonlyArray<string | ExportHeader>,
): ExportGrid {
  const zmanim = zmanHeaders.map((h) => (typeof h === 'string' ? { label: h } : h));
  return {
    headers: [...columns.map((c) => flatHeader(c.header, c.sub)), ...zmanim.map((h) => flatHeader(h.label, h.sub))],
    groupLabels: [...columns.map((c) => c.header), ...zmanim.map((h) => h.label)],
    subHeaders: [...columns.map((c) => c.sub ?? ''), ...zmanim.map((h) => h.sub ?? '')],
    groupKeys: [...columns.map(() => null), ...zmanim.map((h) => h.group ?? null)],
    weights: [...columns.map((c) => dayColumnWeight(c.key)), ...zmanim.map(() => 1)],
    maxWeights: [...columns.map((c) => c.maxWeight ?? 0), ...zmanim.map(() => 0)],
    text: [...columns.map((c) => TEXT_DAY_COLUMNS.has(c.key)), ...zmanim.map(() => false)],
    emphasis: [...columns.map((c) => c.emphasis === true), ...zmanim.map(() => false)],
    rows: table.rows.map((r) => [...columns.map((c) => cellValue(r, c)), ...r.cells]),
    weekStarts: table.rows.map((r) => isWeekStart(r.iso)),
    leadColumns: columns.length,
    keyColumns: leadingIdentityCount(columns),
    rowKeys: table.rows.map((r) => r.iso),
  };
}

/** How many columns at the start of the list identify the row. */
function leadingIdentityCount(columns: ExportColumn[]): number {
  const firstOther = columns.findIndex((c) => c.identity !== true);
  return firstOther === -1 ? columns.length : firstOther;
}

/** Project a grid onto a subset of its columns (order preserved by `cols`). */
export function pickColumns(grid: ExportGrid, cols: number[]): ExportGrid {
  return {
    headers: cols.map((c) => grid.headers[c]),
    groupLabels: cols.map((c) => grid.groupLabels[c]),
    subHeaders: cols.map((c) => grid.subHeaders[c]),
    groupKeys: cols.map((c) => grid.groupKeys[c]),
    weights: cols.map((c) => grid.weights[c]),
    maxWeights: cols.map((c) => grid.maxWeights[c]),
    text: cols.map((c) => grid.text[c]),
    emphasis: cols.map((c) => grid.emphasis[c]),
    rows: grid.rows.map((r) => cols.map((c) => r[c])),
    weekStarts: grid.weekStarts,
    proseRows: grid.proseRows,
    wrapTextColumns: grid.wrapTextColumns,
    columnKeys: grid.columnKeys && cols.map((c) => grid.columnKeys![c]),
    // Recounted, not copied: dropEmptyColumns can remove a lead column too.
    leadColumns: grid.leadColumns === undefined ? undefined : cols.filter((c) => c < grid.leadColumns!).length,
    keyColumns: grid.keyColumns === undefined ? undefined : cols.filter((c) => c < grid.keyColumns!).length,
    rowKeys: grid.rowKeys,
  };
}

/** Slice a grid's rows (keeping the aligned per-row flags in step). */
export function sliceRows(grid: ExportGrid, from: number, to: number): ExportGrid {
  return {
    ...grid,
    rows: grid.rows.slice(from, to),
    // The first row of a page never gets a separator rule above it.
    weekStarts: grid.weekStarts.slice(from, to).map((w, i) => i > 0 && w),
    // Sliced in step, or a page's prose rows would be read off the wrong indices.
    proseRows: grid.proseRows?.slice(from, to),
    rowKeys: grid.rowKeys.slice(from, to),
  };
}

/**
 * Pivot a grid: each original column becomes a row (led by its header in a wide
 * first column), each original row becomes a column (headed by `rowLabels[i]`,
 * the day's date, over `rowSubLabels[i]`, its Hebrew date). `cornerLabel` fills
 * the top-left cell.
 */
export function transposeExportGrid(
  grid: ExportGrid,
  cornerLabel: string,
  rowLabels: string[],
  rowSubLabels?: string[],
): ExportGrid {
  const columns = [cornerLabel, ...rowLabels];
  return {
    headers: columns,
    groupLabels: columns,
    subHeaders: ['', ...rowLabels.map((_, i) => rowSubLabels?.[i] ?? '')],
    groupKeys: columns.map(() => null),
    weights: [2.6, ...rowLabels.map(() => 1)],
    // The label column carries every row's whole identity ("Zman Shma · Magen
    // Avraham 16.1°") and is the ONLY place it appears, so it gets a generous
    // ceiling; day columns hold clock times and short prose and keep a tighter
    // one — wide enough for a long word to wrap on, no wider.
    maxWeights: [TRANSPOSED_LABEL_MAX_WEIGHT, ...rowLabels.map(() => TRANSPOSED_DAY_MAX_WEIGHT)],
    text: [true, ...rowLabels.map(() => false)],
    emphasis: columns.map(() => false),
    rows: grid.headers.map((header, col) => [header, ...grid.rows.map((r) => r[col])]),
    // Transposed rows are fields, not days — no week boundaries run down the
    // page, and each column is headed by its own full date.
    weekStarts: grid.headers.map(() => false),
    // A transposed row IS an original column, so the original's text flags carry
    // over one-for-one: the parsha row is prose, a zman's row is times.
    proseRows: [...grid.text],
    // The label column may wrap to two lines: it is the only place a row's
    // full "name · spelled-out shita" appears, and truncating it loses the
    // one thing the row exists to say.
    wrapTextColumns: true,
    // The days move to the column axis with the label column leading.
    columnKeys: ['', ...grid.rowKeys],
    rowKeys: grid.headers.map(() => ''),
  };
}

// ---------------------------------------------------------------------------
// Fitting a sheet
//
// The sheet sizes itself to its content: column widths come from the longest
// value each column actually holds, and the font then falls out of the page
// width — clamped to a legibility floor. What happens when the floor is not
// enough (splitting into column parts) is the document builder's business
// (document.ts); these are the shared measuring primitives.
// ---------------------------------------------------------------------------

/**
 * The weight-1.0 reference: a clock time. Every column's demand is expressed as
 * a multiple of this string's measured width, so "a time column is 1.0 unit"
 * still holds — it is now measured rather than assumed.
 */
const UNIT_TEXT = '10:07';
/**
 * Lines a header may wrap onto before it needs more width. Three keeps long
 * captions ("Окончание поста", "Latest Shema") narrow enough that they don't
 * dictate the column width — only their longest single WORD does.
 */
const HEADER_LINES = 3;
/**
 * Headers print smaller than the body: they are read once when orienting, while
 * the times are scanned constantly. Shrinking them buys width for the data
 * without breaking long labels like "Окончание поста" across lines.
 */
export const HEADER_FONT_SCALE = 0.85;
/**
 * The opinion tier prints smaller again. Two reasons, both structural rather
 * than cosmetic: it makes the name/opinion hierarchy legible at a glance on a
 * sheet where both tiers would otherwise be the same size, and a smaller label
 * demands less width — which buys the body font back, since the body is sized by
 * the table's width.
 */
export const SUB_HEADER_FONT_SCALE = 0.72;
/**
 * Lines a wrapping text CELL may demand its width from: a value is granted
 * enough width to fit on two lines, and the width fitter charges it half its
 * full length. (The renderer lets a pathological value run to a third line
 * rather than clipping it — see `rowLineCounts`.)
 */
const CELL_WRAP_LINES = 2;
/** A hair of slack on every demand, so a word landing exactly on the column edge still fits. */
const DEMAND_SLACK_PX = 1;
/** Horizontal cell padding, both sides (px). */
const CELL_PADDING_PX = 4;
/** Vertical cell padding, both sides (px). */
const ROW_PADDING_PX = 4;
/** Table line-height multiplier (must match the renderer). */
const LINE_HEIGHT = 1.35;
/** Extra height a week-separator rule adds, amortized across the seven days it heads. */
const WEEK_RULE_PX = 3;
/** Safety margin against font-metric drift, so a page never overflows and clips rows. */
const FIT_SAFETY = 0.96;

/**
 * Width ceiling for the transposed layout's label column, in weight units. Wide
 * enough for the longest "base · spelled-out shita" label; the seven day
 * columns beside it still get over 100 px each.
 */
const TRANSPOSED_LABEL_MAX_WEIGHT = 9;
/**
 * Width ceiling for a transposed DAY column. Wider than a tabular column's
 * usual cap because a prose cell's longest word has to fit inside it — a
 * Russian "освящения" is about 2.25 units, and at the tabular cap it broke
 * mid-word.
 */
const TRANSPOSED_DAY_MAX_WEIGHT = 4;

/** Smallest legible body size; below this the table stops shrinking and splits instead. */
export const MIN_TABLE_FONT_PX = 7;
/**
 * Largest body size for month sheets. Capped so that even a sparse table's
 * rows stay short enough for a full 31-day month to land on one sheet — the
 * month, not the font, is what the reader is looking for.
 */
export const MAX_TABLE_FONT_PX = 10;
/**
 * Largest body size for the weekly layout, whose eight columns would otherwise
 * fit grotesquely large type.
 */
export const WEEK_MAX_FONT_PX = 11;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A tier-1 header run: consecutive columns printed under one spanning label. */
export interface HeaderRun {
  /** Index of the run's first column. */
  start: number;
  /** How many columns it spans. */
  span: number;
  /** The tier-1 label. */
  label: string;
  /** True when no column in the run carries a tier-2 label (so tier 1 spans both rows). */
  full: boolean;
}

/**
 * Group the columns into spanning tier-1 header runs. Only *consecutive*
 * columns sharing a non-null group key merge, so two unrelated columns that
 * happen to share a label never collapse into one header.
 */
export function headerRuns(grid: ExportGrid): HeaderRun[] {
  const runs: HeaderRun[] = [];
  for (let i = 0; i < grid.groupLabels.length; i++) {
    const key = grid.groupKeys[i];
    const prev = runs[runs.length - 1];
    if (prev && key !== null && grid.groupKeys[i - 1] === key) {
      prev.span += 1;
      prev.full = prev.full && grid.subHeaders[i] === '';
      continue;
    }
    runs.push({ start: i, span: 1, label: grid.groupLabels[i], full: grid.subHeaders[i] === '' });
  }
  return runs;
}

/** How many columns each column's tier-1 header spans. */
function runLengths(grid: ExportGrid): number[] {
  const lengths = new Array<number>(grid.groupLabels.length).fill(1);
  for (const run of headerRuns(grid)) {
    for (let i = 0; i < run.span; i++) lengths[run.start + i] = run.span;
  }
  return lengths;
}

/**
 * Column widths derived from what each column actually holds: the longest cell,
 * its own tier-2 label, and its share of a spanning tier-1 label. An all-empty
 * column (a holiday column over a quiet month) collapses to the minimum instead
 * of holding a fixed share of the page, which is where most of the old layout's
 * dead space came from.
 */
export function fitColumnWeights(grid: ExportGrid, m: TextMeasurer = defaultMeasurer()): number[] {
  const runs = runLengths(grid);
  // What one weight unit is worth, measured once.
  const unit = m.width(UNIT_TEXT, REFERENCE_FONT_PX) || 1;
  return grid.headers.map((_, i) => {
    /**
     * A wrapping cell demands the width that fits it on CELL_WRAP_LINES lines —
     * or its longest word, whichever is more. Without this one
     * "Re'eh · Shabbat Mevarchim" in a single day's cell forces the whole
     * column to its full length, and the sheet's type down with it.
     */
    const demandOf = (text: string, row: number) => {
      if (!text) return 0;
      // The identity column is deliberately excluded: it is compact by design
      // ("1 Aug · 18 Av · Wed") and naming the row is its whole job, so wrapping
      // it would inflate every row of the sheet.
      const isKey = i < (grid.keyColumns ?? 0);
      const mayWrap =
        (grid.proseRows?.[row] === true && !grid.text[i]) || (grid.wrapTextColumns === true && grid.text[i] && !isKey);
      const full = m.width(text, REFERENCE_FONT_PX);
      if (!mayWrap) return full;
      const word = text.split(/\s+/).reduce((max, w) => Math.max(max, m.width(w, REFERENCE_FONT_PX)), 0);
      return Math.max(word, full / CELL_WRAP_LINES);
    };
    // The widest value this column actually holds — measured, so a column of
    // short month names doesn't reserve room for the language's longest one.
    const cell = grid.rows.reduce((max, row, r) => Math.max(max, demandOf(row[i] ?? '', r)), 0);
    const sub = headerDemandPx(m, grid.subHeaders[i], 1, SUB_HEADER_FONT_SCALE);
    const group = headerDemandPx(m, grid.groupLabels[i], runs[i], HEADER_FONT_SCALE);
    const demand = Math.max(cell, sub, group) + DEMAND_SLACK_PX;
    // Text columns may run long (a parsha with a special-Shabbat suffix); they
    // are capped — wrapping past the cap — rather than starving every time column.
    const cap = grid.maxWeights[i] || (grid.text[i] ? 3 : 1.8);
    return clamp(demand / unit, 0.7, cap);
  });
}

/**
 * Drop columns that are empty on every row. A print sheet should not spend
 * width on a header for data that isn't there — an Omer column outside the
 * counting period, or fast bookends in a month with no fast. Only blank cells
 * count: a "—" is a real answer (a degree opinion with no time that day) and
 * keeps its column.
 */
export function dropEmptyColumns(grid: ExportGrid): ExportGrid {
  const keep = grid.headers.map((_, i) => grid.rows.length === 0 || grid.rows.some((row) => (row[i] ?? '') !== ''));
  return keep.every(Boolean) ? grid : pickColumns(grid, keep.flatMap((k, i) => (k ? [i] : [])));
}

/**
 * Width a header needs, spread over the columns it spans. Headers wrap, so the
 * whole label need not fit on one line — but a single WORD must, or the label
 * breaks mid-word ("Празд/ник"), which is what a narrow column does to a long
 * Russian or Hebrew caption.
 */
function headerDemandPx(m: TextMeasurer, text: string, span: number, scale: number): number {
  if (!text) return 0;
  const fontPx = REFERENCE_FONT_PX * scale;
  const longestWord = text.split(/\s+/).reduce((max, word) => Math.max(max, m.width(word, fontPx, true)), 0);
  const perLine = m.width(text, fontPx, true) / HEADER_LINES;
  return Math.max(longestWord, perLine) / span;
}

/**
 * The body font size these column weights imply, before the legibility clamp.
 *
 * The weights are demands measured at REFERENCE_FONT_PX, so the total they need
 * is `total × unit` px at that size; text advance being proportional to font
 * size, the size that exactly fills the row is a straight ratio.
 */
export function rawFontSize(weights: number[], m: TextMeasurer = defaultMeasurer()): number {
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const unit = m.width(UNIT_TEXT, REFERENCE_FONT_PX) || 1;
  const available = Math.max(1, CONTENT_WIDTH_PX - CELL_PADDING_PX * weights.length);
  return (available / (total * unit)) * REFERENCE_FONT_PX * FIT_SAFETY;
}

/**
 * Per-column width, as a fraction of the content width, INCLUDING the cell's
 * horizontal padding.
 *
 * Handing each column `weight / total` of the full width looks equivalent but is
 * not, and the difference clipped real data. The font size is chosen so the text
 * fits `CONTENT_WIDTH - padding × n`; distributing the FULL width by weight then
 * charges every column an equal share of that padding *in proportion to its
 * weight*, so a narrow column (a time, weight ≈ 1) standing beside wide text
 * columns (weight 4.6, 5) receives less than the 4px it needs and truncates. At
 * 34 columns that clipped 31 clock times per sheet.
 *
 * Giving each column its padding up front and dividing only what is left keeps
 * every column's text space exactly the width it was measured to need.
 */
export function fitColumnWidths(weights: number[], tableWidthPx = CONTENT_WIDTH_PX): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const textSpace = Math.max(1, tableWidthPx - CELL_PADDING_PX * weights.length);
  return weights.map((w) => (CELL_PADDING_PX + (w / total) * textSpace) / tableWidthPx);
}

/**
 * The width the fitted columns actually ask for at this font, in px — cells,
 * headers and padding. When this comes to well under the page, the sheet is
 * SPARSE: stretching two columns across a landscape page is how a Daf Yomi
 * list ends up with a half-metre of white between the date and the daf, so the
 * document builder uses this to flow a sparse month into side-by-side halves.
 */
export function tableDemandWidthPx(weights: number[], fontPx: number, m: TextMeasurer = defaultMeasurer()): number {
  const unit = m.width(UNIT_TEXT, REFERENCE_FONT_PX) || 1;
  const total = weights.reduce((sum, w) => sum + w, 0);
  return total * unit * (fontPx / REFERENCE_FONT_PX) + weights.length * CELL_PADDING_PX;
}

/**
 * Body font size for a sheet of these columns: as large as the width allows,
 * capped for sparse tables and floored at the legibility limit.
 */
export function fitFontSize(weights: number[], m: TextMeasurer = defaultMeasurer()): number {
  return clamp(rawFontSize(weights, m), MIN_TABLE_FONT_PX, MAX_TABLE_FONT_PX);
}

/**
 * Height the header tiers occupy at this body font size, measured from the
 * actual labels: each run's tier-1 label wraps within the width its columns
 * add up to, and the tallest run sets the tier. A grid with no tier-2 labels
 * at all (a learning sheet) pays for one tier only.
 */
export function fittedHeaderHeight(grid: ExportGrid, fontPx: number, m: TextMeasurer = defaultMeasurer()): number {
  const widths = fitColumnWidths(grid.weights.length ? grid.weights : grid.headers.map(() => 1));
  const px = (f: number) => f * CONTENT_WIDTH_PX - CELL_PADDING_PX;
  const lineCount = (text: string, width: number, scaledPx: number) => {
    if (!text || width <= 0) return 0;
    const needed = m.width(text, REFERENCE_FONT_PX, true) * (scaledPx / REFERENCE_FONT_PX);
    return Math.min(HEADER_LINES, Math.max(1, Math.ceil(needed / width)));
  };

  const namePx = fontPx * HEADER_FONT_SCALE;
  const nameLines = headerRuns(grid).reduce((max, run) => {
    const width = widths.slice(run.start, run.start + run.span).reduce((sum, f) => sum + px(f), 0);
    return Math.max(max, lineCount(run.label, width, namePx));
  }, 1);

  const subPx = fontPx * SUB_HEADER_FONT_SCALE;
  const subLines = grid.subHeaders.reduce((max, sub, i) => Math.max(max, lineCount(sub, px(widths[i]), subPx)), 0);

  const names = nameLines * namePx * LINE_HEIGHT;
  const subs = subLines > 0 ? subLines * subPx * LINE_HEIGHT + 4 : 0;
  return names + subs + 8;
}

/** Vertical space a sheet has for body rows at this body font size. */
export function sheetBodyHeight(fontPx: number, grid: ExportGrid, m: TextMeasurer = defaultMeasurer()): number {
  return (CONTENT_HEIGHT_PX - TITLE_BAND_PX - FOOTER_BAND_PX - fittedHeaderHeight(grid, fontPx, m)) * FIT_SAFETY;
}

/**
 * How many lines each row will actually occupy once its wrapping cells wrap.
 *
 * Estimated from the same measurements the widths came from, so the count
 * matches what gets drawn. Word-based wrapping means this over-estimates a cell
 * that happens to break cleanly — erring toward a shorter page, never a clipped
 * one. The estimate runs one line past CELL_WRAP_LINES because the renderer
 * lets a pathological value take a third line rather than clipping it.
 */
export function rowLineCounts(
  grid: ExportGrid,
  weights: number[],
  fontPx: number,
  m: TextMeasurer = defaultMeasurer(),
  tableWidthPx = CONTENT_WIDTH_PX,
): number[] {
  const widths = fitColumnWidths(weights, tableWidthPx).map((f) => f * tableWidthPx - CELL_PADDING_PX);
  const scale = fontPx / REFERENCE_FONT_PX;
  return grid.rows.map((row, r) => {
    const proseRow = grid.proseRows?.[r] === true;
    if (!proseRow && !grid.wrapTextColumns) return 1; // nothing on this row wraps
    let lines = 1;
    row.forEach((cell, i) => {
      if (!cell || widths[i] <= 0) return;
      // Only the cells that actually wrap count toward the row's height.
      const isKey = i < (grid.keyColumns ?? 0);
      if (!(proseRow && !grid.text[i]) && !(grid.wrapTextColumns && grid.text[i] && !isKey)) return;
      const needed = m.width(cell, REFERENCE_FONT_PX) * scale;
      lines = Math.max(lines, Math.min(CELL_WRAP_LINES + 1, Math.ceil(needed / widths[i])));
    });
    return lines;
  });
}

/**
 * Per-side vertical cell padding. The body font is set by the sheet's WIDTH, so
 * a wide selection leaves vertical slack — this spends it on row spacing so the
 * table fills the sheet instead of stranding a blank half-page under it.
 */
export function fitRowPadding(
  fontPx: number,
  rowCount: number,
  lineTotal: number,
  grid: ExportGrid,
  extraPx = 0,
  m: TextMeasurer = defaultMeasurer(),
): number {
  const min = ROW_PADDING_PX / 2;
  if (rowCount <= 0) return min;
  const used = lineTotal * fontPx * LINE_HEIGHT + rowCount * (ROW_PADDING_PX + WEEK_RULE_PX / 7);
  const slack = sheetBodyHeight(fontPx, grid, m) - extraPx - used;
  return clamp(min + slack / rowCount / 2, min, 6);
}
