import { dayColumnWeight, type DayColumnKey, TEXT_DAY_COLUMNS, type ZmanimTable } from './table';

/** A single enabled column: which row field it reads and its localized header. */
export interface ExportColumn {
  key: DayColumnKey;
  header: string;
}

/** Leading identity columns — repeated on every column-page so rows stay identifiable. */
const IDENTITY_KEYS: ReadonlySet<DayColumnKey> = new Set(['dateLabel', 'weekday', 'hebrewDate', 'holiday']);

/**
 * A fully materialized table ready for any writer (CSV / Excel / PDF): plain
 * string cells plus per-column print hints. The same shape describes a normal
 * table (one row per day) and a transposed one (one row per field) — writers
 * don't care which, so transpose is a single pivot at this boundary.
 */
export interface ExportGrid {
  headers: string[];
  /** Relative print width per column (a zman/time column is the 1.0 unit). */
  weights: number[];
  /** Per column: free text (start-aligned, wider) vs a tabular time/number. */
  text: boolean[];
  /** Per column: an identity column repeated on every column-page (date, holiday…). */
  sticky: boolean[];
  /** Body rows, each aligned to `headers`. */
  rows: string[][];
}

/** Build the normal (day-per-row) grid from the table and its enabled columns. */
export function buildExportGrid(table: ZmanimTable, columns: ExportColumn[], zmanHeaders: string[]): ExportGrid {
  return {
    headers: [...columns.map((c) => c.header), ...zmanHeaders],
    weights: [...columns.map((c) => dayColumnWeight(c.key)), ...zmanHeaders.map(() => 1)],
    text: [...columns.map((c) => TEXT_DAY_COLUMNS.has(c.key)), ...zmanHeaders.map(() => false)],
    sticky: [...columns.map((c) => IDENTITY_KEYS.has(c.key)), ...zmanHeaders.map(() => false)],
    rows: table.rows.map((r) => [...columns.map((c) => r[c.key]), ...r.cells]),
  };
}

/** Project a grid onto a subset of its columns (order preserved by `cols`). */
function pickColumns(grid: ExportGrid, cols: number[]): ExportGrid {
  return {
    headers: cols.map((c) => grid.headers[c]),
    weights: cols.map((c) => grid.weights[c]),
    text: cols.map((c) => grid.text[c]),
    sticky: cols.map((c) => grid.sticky[c]),
    rows: grid.rows.map((r) => cols.map((c) => r[c])),
  };
}

/**
 * Pivot a grid: each original column becomes a row (led by its header in a wide
 * first column), each original row becomes a column (headed by `rowLabels[i]`,
 * the day's date). `cornerLabel` fills the top-left cell.
 */
export function transposeExportGrid(grid: ExportGrid, cornerLabel: string, rowLabels: string[]): ExportGrid {
  return {
    headers: [cornerLabel, ...rowLabels],
    weights: [2.6, ...rowLabels.map(() => 1)],
    text: [true, ...rowLabels.map(() => false)],
    // The field-name column is repeated on every day-page (handled in pagination).
    sticky: [true, ...rowLabels.map(() => false)],
    rows: grid.headers.map((header, col) => [header, ...grid.rows.map((r) => r[col])]),
  };
}

/** Rows (days) per A4-landscape page in the normal orientation. */
export const NORMAL_ROWS_PER_PAGE = 25;
/** Field-rows per page when transposed (they run down the page). */
export const TRANSPOSE_FIELDS_PER_PAGE = 30;
/** Day-columns per page when transposed (they run across the page). */
export const TRANSPOSE_DAYS_PER_PAGE = 12;
/**
 * Per-page column-width budget (in weight units). The A4-landscape content is
 * ~1059px; capping the total weight keeps a time column (weight 1) at ~50px —
 * wide enough to print "2:26 AM" without truncating. Beyond it, data columns
 * spill onto further column-pages (identity columns repeat on each).
 */
export const MAX_PAGE_WEIGHT = 20;

/**
 * Split a grid into A4-landscape pages. Normal: identity columns repeat on each
 * page, the remaining columns are packed into column-pages within the width
 * budget, and each column-page's rows are sliced vertically. Transposed: the
 * field-name column repeats, day columns are sliced across pages, field rows
 * down them.
 */
export function paginateExportGrid(grid: ExportGrid, transpose: boolean): ExportGrid[] {
  if (!transpose) {
    const all = grid.headers.map((_, i) => i);
    const stickyIdx = all.filter((i) => grid.sticky[i]);
    const dataIdx = all.filter((i) => !grid.sticky[i]);
    const stickyWeight = stickyIdx.reduce((sum, i) => sum + grid.weights[i], 0);

    // Pack data columns into groups that fit the width budget alongside the
    // repeated identity columns.
    const colGroups: number[][] = [];
    let group: number[] = [];
    let weight = stickyWeight;
    for (const di of dataIdx) {
      if (group.length > 0 && weight + grid.weights[di] > MAX_PAGE_WEIGHT) {
        colGroups.push(group);
        group = [];
        weight = stickyWeight;
      }
      group.push(di);
      weight += grid.weights[di];
    }
    if (group.length > 0 || colGroups.length === 0) colGroups.push(group);

    const pages: ExportGrid[] = [];
    for (const g of colGroups) {
      const sub = pickColumns(grid, [...stickyIdx, ...g]);
      if (sub.rows.length === 0) {
        pages.push(sub);
        continue;
      }
      for (let i = 0; i < sub.rows.length; i += NORMAL_ROWS_PER_PAGE) {
        pages.push({ ...sub, rows: sub.rows.slice(i, i + NORMAL_ROWS_PER_PAGE) });
      }
    }
    return pages;
  }

  const pages: ExportGrid[] = [];
  const dayCount = grid.headers.length - 1; // column 0 is the field-name label column
  for (let d = 0; d < dayCount; d += TRANSPOSE_DAYS_PER_PAGE) {
    // Keep the label column (0), then this page's slice of day columns.
    const cols = [0, ...Array.from({ length: Math.min(TRANSPOSE_DAYS_PER_PAGE, dayCount - d) }, (_, k) => d + 1 + k)];
    const sub = pickColumns(grid, cols);
    for (let f = 0; f < sub.rows.length; f += TRANSPOSE_FIELDS_PER_PAGE) {
      pages.push({ ...sub, rows: sub.rows.slice(f, f + TRANSPOSE_FIELDS_PER_PAGE) });
    }
  }
  return pages;
}
