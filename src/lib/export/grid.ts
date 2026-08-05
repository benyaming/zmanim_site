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
   * This column IDENTIFIES the row (the date) rather than carrying data about it.
   * Stacked blocks repeat these and nothing else: a holiday name, a candle time or
   * a Daf Yomi reading belongs to exactly one block, printed once.
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
   * and demand only their longest word. Set by the transposed layout ONLY, where
   * a row is a former column and its kind is therefore known exactly.
   *
   * Deliberately structural rather than sniffed from the text: an English time
   * prints as "4:23 AM", which contains letters, so a content heuristic would
   * call it prose and break it across two lines — where it reads as two numbers.
   */
  proseRows?: boolean[];
  /**
   * How many leading columns are day columns rather than zmanim.
   */
  leadColumns?: number;
  /**
   * How many leading columns identify the row — in practice the date. These are the
   * ONLY columns a stacked block repeats; everything else, day column or zman, is
   * data and is printed in exactly one block. Repeating all the day columns instead
   * duplicated seven learning readings across three blocks, which both wasted the
   * width the stacking was meant to buy and read as an error.
   */
  keyColumns?: number;
  /**
   * Per COLUMN: this column is the first day of a calendar week. Set by the
   * transposed layout, where a column is a day — it is what lets the paginator
   * break bands of days on week boundaries instead of at an arbitrary count.
   */
  columnWeekStarts?: boolean[];
  /**
   * Body font size the paginator settled on for this page, when it is not simply
   * the widest that fits. Set for a turned sheet whose type was brought DOWN so
   * that every zman fits on one page: the renderer must draw the size that was
   * measured, not re-derive a larger one from the widths.
   */
  fontPx?: number;
  /**
   * Text columns on this grid may WRAP rather than truncate, and therefore demand
   * only their longest word. Set on stacked blocks, where a page carrying one week
   * has height to spare: a Rambam Yomi reading ("Laws of sanctifying the month 6")
   * wants twice the 3-unit ceiling a text column gets, and truncating it loses the
   * reading. Left off for a normal upright sheet, where taller rows would cost it
   * days per page.
   */
  wrapTextColumns?: boolean;
  /**
   * Total wrapped LINES this page's rows occupy. Set by the paginator when any row
   * wraps; `fitRowPadding` spends leftover height per LINE, and counting rows
   * instead would over-pad a page of multi-line rows straight off the paper.
   */
  lineTotal?: number;
  /**
   * Per row: the day's ISO date. Lets the caller map a paginated page back to
   * the days on it, for footer material (fast times, the molad) that belongs
   * once per page rather than in a column of its own.
   */
  rowKeys: string[];
  /**
   * Per COLUMN: the day's ISO date, for the transposed layout where a column IS a
   * day. The pivot leaves `rowKeys` empty — rows are fields there — so without
   * this the page could not say which days it holds, and every fast bookend and
   * molad line silently vanished from a transposed sheet.
   *
   * Read through `dayKeys`, which picks whichever axis the days are on.
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

/**
 * The ISO dates a page holds, from whichever axis the days are on: rows for an
 * upright sheet, columns for a transposed one. What page footnotes key off.
 */
export function dayKeys(grid: ExportGrid): string[] {
  const keys = grid.columnKeys ?? grid.rowKeys;
  return keys.filter((key) => key !== '');
}

/** Project a grid onto a subset of its columns (order preserved by `cols`). */
function pickColumns(grid: ExportGrid, cols: number[]): ExportGrid {
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
    columnWeekStarts: grid.columnWeekStarts && cols.map((c) => grid.columnWeekStarts![c]),
    // Banding splits the days, so a band must carry only its own.
    columnKeys: grid.columnKeys && cols.map((c) => grid.columnKeys![c]),
    // Recounted, not copied: dropEmptyColumns can remove a lead column too.
    leadColumns: grid.leadColumns === undefined ? undefined : cols.filter((c) => c < grid.leadColumns!).length,
    keyColumns: grid.keyColumns === undefined ? undefined : cols.filter((c) => c < grid.keyColumns!).length,
    rowKeys: grid.rowKeys,
  };
}

/** Slice a grid's rows (keeping the aligned per-row flags in step). */
function sliceRows(grid: ExportGrid, from: number, to: number): ExportGrid {
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
 * the day's date). `cornerLabel` fills the top-left cell.
 */
export function transposeExportGrid(grid: ExportGrid, cornerLabel: string, rowLabels: string[]): ExportGrid {
  const columns = [cornerLabel, ...rowLabels];
  return {
    headers: columns,
    groupLabels: columns,
    subHeaders: columns.map(() => ''),
    groupKeys: columns.map(() => null),
    weights: [2.6, ...rowLabels.map(() => 1)],
    // The label column carries every row's whole identity ("Zman Shma · Magen
    // Avraham 16.1°") and is the ONLY place it appears, so the 3-unit ceiling a
    // text column normally gets truncated it to "Zman Shma · M…" — unreadable,
    // and worst of all in the transposed layout, which exists precisely to give
    // those labels room. Day columns hold clock times and keep the default.
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
    // The days move to the column axis with the label column leading.
    columnKeys: ['', ...grid.rowKeys],
    // The original's per-ROW week flags are per-COLUMN once pivoted. The label
    // column leads and is never a week start.
    columnWeekStarts: [false, ...grid.weekStarts],
    rowKeys: grid.headers.map(() => ''),
  };
}

// ---------------------------------------------------------------------------
// Fitting the grid onto A4 landscape
//
// The PDF sizes itself to its content rather than to fixed constants: column
// widths come from the longest value each column actually holds, and the font
// then shrinks — to a legibility floor — until every selected column fits one
// sheet. Only when even the floor can't fit does the table spill onto further
// column-pages. This is what keeps a normal month's selection on a single page.
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
 * enough for the longest "base · shita" label; a month of days alongside it still
 * fits at the maximum body size, so the room costs nothing in practice.
 */
const TRANSPOSED_LABEL_MAX_WEIGHT = 8;
/**
 * Width ceiling for a transposed DAY column. Wider than a tabular column's usual
 * 1.8 because a prose row's longest word has to fit inside it — a Russian
 * "освящения" is about 2.25 units, and at the tabular cap it broke mid-word.
 * Column banding, not truncation, is what keeps the sheet legible once these add
 * up past a page.
 */
const TRANSPOSED_DAY_MAX_WEIGHT = 4;

/** Smallest legible body size; below this the table stops shrinking and splits instead. */
export const MIN_TABLE_FONT_PX = 6.5;
/**
 * Largest body size. Capped so that even a sparse table's rows stay short
 * enough for a full 31-day month to land on one sheet — the month, not the
 * font, is what the reader is looking for. `fitRowsPerPage` pins this.
 */
export const MAX_TABLE_FONT_PX = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Smallest type the sheet may print, in CSS px. The page is placed on A4 at
 * 297 mm for 1123 px, so 1 px ≈ 0.75 pt: this floor is about 4.9 pt, which is
 * fine print but readable. Below it the header stops being text and becomes
 * texture — the state a 30-zman selection used to reach (opinion labels at
 * 5.1 px) and the reason this gate exists.
 */
export const MIN_LEGIBLE_PX = 6.5;

/**
 * Selected-zman count past which the dialog warns, before anything is built.
 *
 * Advisory only — `layoutLegibility` is the authority, and it measures the real
 * grid. This number is where the opinion tier crosses MIN_LEGIBLE_PX in Russian,
 * whose spelled-out labels are the widest of the three languages, so the hint
 * errs toward appearing slightly early in Hebrew and English.
 */
export const LEGIBLE_ZMAN_HINT = 27;

export interface LayoutLegibility {
  /** Fitted body font size. */
  fontPx: number;
  /** Size the zman names print at. */
  namePx: number;
  /** Size the opinion labels print at — the smallest type on the sheet. */
  subPx: number;
  /** The smallest type this layout would actually print. */
  smallestPx: number;
  /** True when every label on the sheet clears MIN_LEGIBLE_PX. */
  legible: boolean;
}

/**
 * What this column set would print at, and whether that is readable. Pass a page
 * from `paginateExportGrid`, whose weights are the fitted ones; handed an
 * unfitted grid it fits a copy, which is the same answer but slower.
 *
 * The binding constraint is the opinion tier, the smallest text on the sheet —
 * but only when some column actually carries an opinion; a selection of
 * single-opinion zmanim is limited by the names instead. Both scale with the
 * body font, which is set by the table's WIDTH, so this is really a verdict on
 * how many columns were asked for.
 */
export function layoutLegibility(grid: ExportGrid, m: TextMeasurer = defaultMeasurer()): LayoutLegibility {
  const weights = grid.weights.length ? grid.weights : fitColumnWeights(grid, m);
  const fontPx = fitFontSize(weights, m);
  const namePx = fontPx * HEADER_FONT_SCALE;
  const subPx = fontPx * SUB_HEADER_FONT_SCALE;
  const hasOpinions = grid.subHeaders.some((s) => s !== '');
  const smallestPx = hasOpinions ? subPx : namePx;
  return { fontPx, namePx, subPx, smallestPx, legible: smallestPx >= MIN_LEGIBLE_PX };
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
     * A cell in a prose row demands only its longest WORD, exactly as a wrapping
     * header does, because it is allowed to wrap. Without this one
     * "Re'eh · Shabbat Mevarchim" in a single day's column forced EVERY day
     * column to its cap, and a month of those dragged the sheet's type to the
     * legibility floor. The label column keeps its own generous budget and is
     * measured whole.
     */
    const demandOf = (text: string, row: number) => {
      if (!text) return 0;
      // The identity column is deliberately excluded: it is compact by design
      // ("5 Aug · 22 Av · Wed") and naming the row is its whole job, so wrapping it
      // to three lines inflated every row and cost the page a third of its days.
      const isKey = i < (grid.keyColumns ?? 0);
      const mayWrap =
        (grid.proseRows?.[row] === true && !grid.text[i]) ||
        (grid.wrapTextColumns === true && grid.text[i] && !isKey);
      if (!mayWrap) return m.width(text, REFERENCE_FONT_PX);
      return text.split(/\s+/).reduce((max, word) => Math.max(max, m.width(word, REFERENCE_FONT_PX)), 0);
    };
    // The widest value this column actually holds — measured, so a column of
    // short month names doesn't reserve room for the language's longest one.
    const cell = grid.rows.reduce((max, row, r) => Math.max(max, demandOf(row[i] ?? '', r)), 0);
    const sub = headerDemandPx(m, grid.subHeaders[i], 1, SUB_HEADER_FONT_SCALE);
    const group = headerDemandPx(m, grid.groupLabels[i], runs[i], HEADER_FONT_SCALE);
    const demand = Math.max(cell, sub, group) + DEMAND_SLACK_PX;
    // Text columns may run long (a parsha with a special-Shabbat suffix); they
    // are capped and truncate rather than starving every time column.
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
 * Width a header needs, in body characters, spread over the columns it spans.
 * Headers wrap, so the whole label need not fit on one line — but a single WORD
 * must, or the label breaks mid-word ("Празд/ник"), which is what a narrow
 * column does to a long Russian or Hebrew caption.
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
function rawFontSize(weights: number[], m: TextMeasurer): number {
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const unit = m.width(UNIT_TEXT, REFERENCE_FONT_PX) || 1;
  const available = Math.max(1, CONTENT_WIDTH_PX - CELL_PADDING_PX * weights.length);
  return (available / (total * unit)) * REFERENCE_FONT_PX;
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
export function fitColumnWidths(weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const textSpace = Math.max(1, CONTENT_WIDTH_PX - CELL_PADDING_PX * weights.length);
  return weights.map((w) => (CELL_PADDING_PX + (w / total) * textSpace) / CONTENT_WIDTH_PX);
}

/**
 * Body font size for a page of these columns: as large as the content allows,
 * capped for sparse tables and floored at the legibility limit. The renderer
 * calls this with the same weights the paginator used, so the layout it draws
 * is exactly the one that was fitted.
 */
export function fitFontSize(weights: number[], m: TextMeasurer = defaultMeasurer()): number {
  return clamp(rawFontSize(weights, m) * FIT_SAFETY, MIN_TABLE_FONT_PX, MAX_TABLE_FONT_PX);
}

/**
 * Height the two wrapped header tiers occupy at this body font size. The tiers
 * are measured separately because they print at different sizes; the constant
 * covers their paddings and the rule between them.
 */
function headerHeight(fontPx: number): number {
  const names = fontPx * HEADER_FONT_SCALE * LINE_HEIGHT * HEADER_LINES;
  const opinions = fontPx * SUB_HEADER_FONT_SCALE * LINE_HEIGHT * HEADER_LINES;
  return names + opinions + 10;
}

/** Vertical space a page has for body rows at this body font size. */
function bodyHeight(fontPx: number): number {
  return CONTENT_HEIGHT_PX - TITLE_BAND_PX - FOOTER_BAND_PX - headerHeight(fontPx);
}

/** How many body rows fit under the header at this font size. */
export function fitRowsPerPage(fontPx: number): number {
  const rowPx = fitRowHeight(fontPx);
  return Math.max(8, Math.floor((bodyHeight(fontPx) * FIT_SAFETY) / rowPx));
}

/**
 * Largest font size, within the legibility clamps, at which `rowCount` rows all
 * fit one page — or null when even the floor cannot hold them.
 *
 * Turned sheets want this: a page carrying every zman for a week or two is the
 * layout being asked for, and it is worth spending type size on. Bisected because
 * the body's height budget itself shrinks as the font grows (the header grows with
 * it), so there is no closed form.
 */
function fontFittingRows(rowCount: number): number | null {
  const fits = (f: number) => rowCount * fitRowHeight(f) <= bodyHeight(f) * FIT_SAFETY;
  if (!fits(MIN_TABLE_FONT_PX)) return null;
  if (fits(MAX_TABLE_FONT_PX)) return MAX_TABLE_FONT_PX;
  let lo = MIN_TABLE_FONT_PX;
  let hi = MAX_TABLE_FONT_PX;
  for (let i = 0; i < 30 && hi - lo > 0.01; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Height of a single-line body row at this font size. */
function fitRowHeight(fontPx: number): number {
  return fontPx * LINE_HEIGHT + ROW_PADDING_PX + WEEK_RULE_PX / 7;
}

/**
 * How many lines each row will actually occupy once its wrapping cells wrap.
 *
 * `fitRowsPerPage` alone assumes every row is one line tall, which is true until
 * a prose row wraps: a transposed sheet's learning rows run three and four lines
 * each, so a page counted as fitting 36 rows overflowed and the sheet — reporting
 * "1 / 1" — silently clipped everything past the paper's edge. Estimated from the
 * same measurements the widths came from, so the count matches what gets drawn.
 */
function rowLineCounts(grid: ExportGrid, weights: number[], fontPx: number, m: TextMeasurer): number[] {
  const widths = fitColumnWidths(weights).map((f) => f * CONTENT_WIDTH_PX - CELL_PADDING_PX);
  const scale = fontPx / REFERENCE_FONT_PX;
  return grid.rows.map((row, r) => {
    const proseRow = grid.proseRows?.[r] === true;
    if (!proseRow && !grid.wrapTextColumns) return 1; // nothing on this row wraps
    let lines = 1;
    row.forEach((cell, i) => {
      if (!cell || widths[i] <= 0) return;
      // Only the cells that actually wrap count toward the row's height.
      if (!proseRow && !(grid.text[i] && i >= (grid.keyColumns ?? 0))) return;
      const needed = m.width(cell, REFERENCE_FONT_PX) * scale;
      // Wrapping is word-based, so this over-estimates a cell that happens to
      // break cleanly — erring toward a shorter page, never a clipped one.
      lines = Math.max(lines, Math.min(HEADER_LINES + 1, Math.ceil(needed / widths[i])));
    });
    return lines;
  });
}

/**
 * Per-side vertical cell padding. The body font is set by the table's WIDTH, so
 * a wide selection leaves vertical slack — this spends it on row spacing so the
 * table fills the sheet instead of stranding a blank half-page under it.
 */
export function fitRowPadding(fontPx: number, rowCount: number, lineTotal = rowCount): number {
  const min = ROW_PADDING_PX / 2;
  if (rowCount <= 0) return min;
  const used = lineTotal * fontPx * LINE_HEIGHT + rowCount * ROW_PADDING_PX;
  const slack = bodyHeight(fontPx) * FIT_SAFETY - used;
  return clamp(min + slack / rowCount / 2, min, 6);
}

/**
 * Split a grid into A4-landscape pages.
 *
 * A day is never split across sheets: every selected column for a date stays on
 * that date's page, so the reader holds ONE sheet to read one day. Pages
 * therefore divide by ROWS only, and the font shrinks to fit the whole column
 * set across the width. Past the legibility floor the widest text columns
 * truncate rather than the table breaking apart — the deliberate trade, since a
 * cramped but complete row beats one you must reassemble from two sheets.
 *
 * Empty columns are dropped first, so nothing spends width on a bare header.
 */
export function paginateExportGrid(grid: ExportGrid, m: TextMeasurer = defaultMeasurer()): ExportGrid[] {
  const trimmed = dropEmptyColumns(grid);
  if (trimmed.rows.length === 0) return [{ ...trimmed, weights: fitColumnWeights(trimmed, m) }];

  // Transposed sheets divide by columns first. A column there is a DAY, so this
  // splits by date — the safe axis, since a date's whole column still lands on
  // one sheet. It is also the only axis that can widen a column: without it a
  // month of days leaves each one narrower than a single Russian word, which then
  // breaks mid-word ("освящени|я").
  const bands = trimmed.proseRows ? splitColumnBands(trimmed, m) : [trimmed];

  return bands.flatMap((band) => {
    const fitted: ExportGrid = { ...band, weights: fitColumnWeights(band, m) };
    const widthFont = fitFontSize(fitted.weights, m);
    // A turned sheet exists to answer for whole days, so keeping every zman on the
    // page beats printing them larger across two: if a smaller (still legible) size
    // fits them all, take it. Untouched for upright sheets, where rows are DAYS and
    // paginating them is the normal, harmless thing.
    const rowFont = fitted.proseRows ? fontFittingRows(fitted.rows.length) : null;
    const fontPx = rowFont !== null && rowFont < widthFont ? rowFont : widthFont;
    const page = fontPx === widthFont ? fitted : { ...fitted, fontPx };
    return sliceByHeight(page, fontPx, m);
  });
}

/**
 * Split a transposed grid's day columns into bands, repeating the label column on
 * each so every band reads on its own.
 *
 * Bands are whole CALENDAR WEEKS, and that is the point: a luach is read by the
 * week, so a sheet that ends mid-week is worse than one more sheet. Widest-first —
 * the whole range on one sheet, else a fortnight, else a single week — and the
 * first band that prints legibly wins. Splitting at an arbitrary column count
 * instead put a Wednesday-to-Wednesday band on a page, which is legible and still
 * wrong.
 */
const BAND_WEEKS = [2, 1];

function splitColumnBands(grid: ExportGrid, m: TextMeasurer): ExportGrid[] {
  const dayCount = grid.headers.length - 1;
  if (dayCount <= 1) return [grid];

  // Same "smallest type on the sheet" rule as layoutLegibility: a transposed grid
  // has no opinion tier, so its names are the smallest text.
  const scale = grid.subHeaders.some((sub) => sub !== '') ? SUB_HEADER_FONT_SCALE : HEADER_FONT_SCALE;
  const legible = (cols: number[]) =>
    fitFontSize(fitColumnWeights(pickColumns(grid, cols), m), m) * scale >= MIN_LEGIBLE_PX;

  const all = [0, ...range(1, dayCount + 1)];
  if (legible(all)) return [grid];

  // Day columns grouped into weeks. The first group may be a partial week when the
  // range doesn't begin on a Sunday, and the last when it doesn't end on a Shabbat.
  const weeks: number[][] = [];
  for (let col = 1; col <= dayCount; col++) {
    if (weeks.length === 0 || grid.columnWeekStarts?.[col]) weeks.push([]);
    weeks[weeks.length - 1].push(col);
  }

  for (const perBand of BAND_WEEKS) {
    const bands: number[][] = [];
    for (let i = 0; i < weeks.length; i += perBand) bands.push(weeks.slice(i, i + perBand).flat());
    // Judge the widest band — every band must print, not just the average one.
    const widest = bands.reduce((a, b) => (b.length > a.length ? b : a), bands[0] ?? []);
    if (perBand === BAND_WEEKS[BAND_WEEKS.length - 1] || legible([0, ...widest])) {
      return bands.map((band) => pickColumns(grid, [0, ...band]));
    }
  }
  return [grid];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
}

/**
 * Slice rows into pages by accumulated HEIGHT rather than by count, so a page
 * holding wrapped multi-line rows carries fewer of them instead of overflowing.
 */
function sliceByHeight(grid: ExportGrid, fontPx: number, m: TextMeasurer): ExportGrid[] {
  const lines = rowLineCounts(grid, grid.weights, fontPx, m);
  const uniform = lines.every((l) => l === 1);
  if (uniform) {
    const perPage = fitRowsPerPage(fontPx);
    const pages: ExportGrid[] = [];
    for (let i = 0; i < grid.rows.length; i += perPage) pages.push(sliceRows(grid, i, i + perPage));
    return pages;
  }

  const budget = bodyHeight(fontPx) * FIT_SAFETY;
  const rowPx = (i: number) => lines[i] * fontPx * LINE_HEIGHT + ROW_PADDING_PX;
  const sum = (from: number, to: number) => lines.slice(from, to).reduce((t, l) => t + l, 0);
  const heights = grid.rows.map((_, i) => rowPx(i));

  /** Row index each page starts at, filling greedily up to `limit`. */
  const breaksFor = (limit: number): number[] => {
    const starts = [0];
    let used = 0;
    for (let i = 0; i < heights.length; i++) {
      // Always keep at least one row on a page, however tall it is.
      if (used > 0 && used + heights[i] > limit) {
        starts.push(i);
        used = 0;
      }
      used += heights[i];
    }
    return starts;
  };

  // Filling greedily to the brim packs the first page and strands the remainder —
  // a month of learning rows came out as 31 rows and then a single orphan row on a
  // sheet of its own. Filling to an even share instead needs MORE pages than the
  // budget requires, because each page then stops short of it.
  //
  // So: take the page count the budget forces, then find the smallest limit that
  // still fits in that many pages. That is the classic "split into k parts,
  // minimise the largest part", and bisection settles it — the pages come out as
  // even as they can be without costing a sheet.
  const pageCount = breaksFor(budget).length;
  let lo = Math.max(...heights);
  let hi = budget;
  for (let i = 0; i < 40 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (breaksFor(mid).length <= pageCount) hi = mid;
    else lo = mid;
  }

  const starts = breaksFor(hi);
  return starts.map((start, i) => {
    const end = starts[i + 1] ?? grid.rows.length;
    return { ...sliceRows(grid, start, end), lineTotal: sum(start, end) };
  });
}

// ---------------------------------------------------------------------------
// Stacked sheets
//
// A selection too wide for one row of columns is printed as several STACKED
// BLOCKS on the same page: the week's days appear once with the first slice of
// zmanim, then again below with the next. Every day and every zman is on the one
// page, and the columns get several times the width they would have had.
//
// This is what a printed luach does, and it is the only layout that satisfies all
// three constraints at once — a date answered by one sheet, every selected zman
// present, and type big enough to read. Turning the sheet keeps the days together
// but splits the zmanim down the page; banding the zmanim splits the date. Only
// stacking spends the page's spare HEIGHT to buy column WIDTH.
// ---------------------------------------------------------------------------

/** Vertical gap between two stacked blocks (px). */
const BLOCK_GAP_PX = 10;
/** Most blocks worth stacking; past this each band is too short to read as a table. */
const MAX_BLOCKS = 6;
/**
 * Days to try per page, widest first. Whole weeks are the point — a luach is read
 * by the week — but an extreme selection (every zman AND every learning cycle, whose
 * readings wrap to three lines) cannot fit even one week beside enough blocks, so
 * the ladder continues below a week rather than giving up. Giving up meant falling
 * back to ONE unstacked page with sixty columns, every cell truncated: the worst
 * sheet of all the options.
 */
const DAYS_PER_SHEET = [14, 7, 4, 2, 1];

export interface ExportSheet {
  /** Tables stacked down one page: the same days, a different slice of zmanim. */
  blocks: ExportGrid[];
  /** Body font size shared by every block, so the page reads as one sheet. */
  fontPx: number;
}

/** Vertical space a page has for stacked blocks. */
function stackBudget(): number {
  return (CONTENT_HEIGHT_PX - TITLE_BAND_PX - FOOTER_BAND_PX) * FIT_SAFETY;
}

/**
 * Pages for a grid, each as a list of stacked blocks. One block per page is the
 * normal case; a sheet only stacks when its columns cannot otherwise be read.
 */
export function paginateExportSheets(grid: ExportGrid, m: TextMeasurer = defaultMeasurer()): ExportSheet[] {
  const trimmed = dropEmptyColumns(grid);
  const single = () =>
    paginateExportGrid(grid, m).map((page) => ({
      blocks: [page],
      fontPx: page.fontPx ?? fitFontSize(page.weights, m),
    }));

  // Turned sheets have their own answer (days banded by the week), and a grid with
  // no identity columns has nothing to repeat above each block.
  if (trimmed.proseRows || !trimmed.leadColumns) return single();

  const weights = fitColumnWeights(trimmed, m);
  if (layoutLegibility({ ...trimmed, weights }, m).legible) return single();

  return stackedSheets(trimmed, m) ?? single();
}

/**
 * Everything after the identity columns, in contiguous units: each day column
 * stands alone, and a base's opinions stay together.
 */
function distributableUnits(grid: ExportGrid, from: number): number[][] {
  const units: number[][] = [];
  for (let col = from; col < grid.headers.length; col++) {
    const key = grid.groupKeys[col];
    const prev = units[units.length - 1];
    if (prev && key !== null && grid.groupKeys[col - 1] === key) prev.push(col);
    else units.push([col]);
  }
  return units;
}

/** Row index groups: the days of each calendar week. */
function weekRows(grid: ExportGrid): number[][] {
  const weeks: number[][] = [];
  grid.rows.forEach((_, row) => {
    if (weeks.length === 0 || grid.weekStarts[row]) weeks.push([]);
    weeks[weeks.length - 1].push(row);
  });
  return weeks;
}

function stackedSheets(grid: ExportGrid, m: TextMeasurer): ExportSheet[] | null {
  // Only the date repeats. Without one there is nothing to identify a block's rows
  // by, so stacking would be unreadable — leave such a grid as a single block.
  const keys = grid.keyColumns ?? 0;
  if (keys === 0) return null;
  // Balance the blocks by how much WIDTH each column wants, not by how many there
  // are: seven spelled-out learning readings need far more room than seven clock
  // times, and counting columns put them all in one block where they truncated.
  const fullWeights = fitColumnWeights(grid, m);
  const leadCols = range(0, keys);
  const units = distributableUnits(grid, keys);
  if (units.length < 2) return null;
  const weeks = weekRows(grid);

  // The last configuration tried, used when nothing fits outright: a slightly
  // over-full stacked page still reads, where the unstacked fallback does not.
  let fallback: ExportSheet[] | null = null;

  for (const daysPerSheet of DAYS_PER_SHEET) {
    const dayBands = dayBandsOf(weeks, daysPerSheet);
    const tallest = dayBands.reduce((a, b) => (b.length > a.length ? b : a), dayBands[0]);

    for (let blocks = 2; blocks <= Math.min(MAX_BLOCKS, units.length); blocks++) {
      const slices = sliceUnits(units, blocks, fullWeights);
      if (slices.length !== blocks) continue;

      // One font for the whole page: the smallest any block needs, so the blocks
      // line up as one sheet rather than reading as three unrelated tables.
      const fonts = slices.map((slice) => fitFontSize(fitColumnWeights(pickColumns(grid, [...leadCols, ...slice]), m), m));
      const fontPx = Math.min(...fonts);
      const smallest = fontPx * (grid.subHeaders.some((sub) => sub !== '') ? SUB_HEADER_FONT_SCALE : HEADER_FONT_SCALE);
      if (smallest < MIN_LEGIBLE_PX) continue;

      // Build the tallest band's blocks for real, so the height check counts the
      // lines a wrapped reading actually takes rather than assuming one apiece.
      const build = (days: number[]) =>
        slices.map((slice) => {
          const columns = pickColumns(grid, [...leadCols, ...slice]);
          const rows = sliceRows(columns, days[0], days[days.length - 1] + 1);
          const block: ExportGrid = { ...rows, wrapTextColumns: true, fontPx };
          block.weights = fitColumnWeights(block, m);
          const lines = rowLineCounts(block, block.weights, fontPx, m);
          return { block: { ...block, lineTotal: lines.reduce((t, l) => t + l, 0) }, lines };
        });

      const probe = build(tallest);
      const needed =
        probe.reduce(
          (sum, { lines }) =>
            sum + headerHeight(fontPx) + lines.reduce((t, l) => t + l * fontPx * LINE_HEIGHT + ROW_PADDING_PX, 0),
          0,
        ) + (blocks - 1) * BLOCK_GAP_PX;

      const sheets = () => dayBands.map((days) => ({ fontPx, blocks: build(days).map(({ block }) => block) }));
      // Remember the tightest arrangement seen, whether or not it fits.
      fallback = sheets();
      if (needed <= stackBudget()) return sheets();
    }
  }
  return fallback;
}

/**
 * Group day rows into the bands one page carries. A week or more breaks on week
 * boundaries; below that the chunks are sequential, since there is no way to keep a
 * week whole on a page that cannot hold one.
 */
function dayBandsOf(weeks: number[][], daysPerSheet: number): number[][] {
  const bands: number[][] = [];
  if (daysPerSheet >= 7) {
    const perBand = Math.max(1, Math.floor(daysPerSheet / 7));
    for (let i = 0; i < weeks.length; i += perBand) bands.push(weeks.slice(i, i + perBand).flat());
    return bands;
  }
  const days = weeks.flat();
  for (let i = 0; i < days.length; i += daysPerSheet) bands.push(days.slice(i, i + daysPerSheet));
  return bands;
}

/**
 * Split units into `count` contiguous slices carrying roughly equal WIDTH DEMAND.
 * Balancing by column count instead leaves a slice of wide text columns starved
 * beside a slice of narrow times, and the wide one truncates.
 */
function sliceUnits(units: number[][], count: number, weights: number[]): number[][] {
  const demand = (unit: number[]) => unit.reduce((sum, col) => sum + (weights[col] ?? 1), 0);
  const total = units.reduce((sum, u) => sum + demand(u), 0);
  const target = total / count;
  const slices: number[][] = [];
  let current: number[] = [];
  let used = 0;
  for (const unit of units) {
    const want = demand(unit);
    // Cross the target only if this unit is more in than out of it — otherwise a
    // wide unit lands in whichever slice it overflows least.
    if (used > 0 && used + want / 2 > target && slices.length < count - 1) {
      slices.push(current);
      current = [];
      used = 0;
    }
    current.push(...unit);
    used += want;
  }
  if (current.length) slices.push(current);
  return slices;
}
