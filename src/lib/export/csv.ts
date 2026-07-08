import { downloadBlob } from './download';
import type { DayColumnKey, ZmanimTable } from './table';

/** UTF-8 byte-order mark — makes spreadsheet apps read the file as UTF-8. */
const BOM = '\uFEFF';

export interface CsvExportOptions {
  table: ZmanimTable;
  /** Localized headers for the fixed leading columns (date, weekday, Hebrew date, holiday). */
  fixedHeaders: string[];
  /** Enabled per-day columns (parsha, candle lighting, …) with localized headers. */
  dayColumns: { key: DayColumnKey; header: string }[];
  /** Localized header per table key, aligned with `table.keys`. */
  zmanHeaders: string[];
  /** Attribution line appended as a trailing row. */
  footer: string;
  filename: string;
}

/** RFC 4180 quoting: wrap in quotes and double any embedded quote when needed. */
function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize the zmanim table to a CRLF-delimited, RFC 4180-quoted CSV string. */
export function zmanimTableToCsv(o: Omit<CsvExportOptions, 'filename'>): string {
  const rows: string[][] = [[...o.fixedHeaders, ...o.dayColumns.map((c) => c.header), ...o.zmanHeaders]];
  for (const row of o.table.rows) {
    rows.push([row.dateLabel, row.weekday, row.hebrewDate, row.holiday, ...o.dayColumns.map((c) => row[c.key]), ...row.cells]);
  }
  rows.push([]);
  rows.push([o.footer]);
  return rows.map((cols) => cols.map(escapeCell).join(',')).join('\r\n');
}

/** Build and download the zmanim table as a UTF-8 CSV file. */
export function exportTableToCsv(o: CsvExportOptions): void {
  // Prepend a BOM so spreadsheet apps open the UTF-8 content (Hebrew/Russian) correctly.
  downloadBlob(new Blob([BOM + zmanimTableToCsv(o)], { type: 'text/csv;charset=utf-8' }), o.filename);
}
