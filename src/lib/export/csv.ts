import { downloadBlob } from './download';
import type { ExportGrid } from './grid';

/** UTF-8 byte-order mark — makes spreadsheet apps read the file as UTF-8. */
const BOM = '\uFEFF';

export interface CsvExportOptions {
  /** The materialized table (already transposed if requested). */
  grid: ExportGrid;
  /** Attribution line appended as a trailing row. */
  footer: string;
  /** Compute-option note (elevation / lehumra); empty when none apply. */
  notes?: string;
  filename: string;
}

/** RFC 4180 quoting: wrap in quotes and double any embedded quote when needed. */
function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize the export grid to a CRLF-delimited, RFC 4180-quoted CSV string. */
export function exportGridToCsv(grid: ExportGrid, footer: string, notes = ''): string {
  const rows: string[][] = [grid.headers, ...grid.rows, []];
  if (notes) rows.push([notes]);
  rows.push([footer]);
  return rows.map((cols) => cols.map(escapeCell).join(',')).join('\r\n');
}

/** Build and download the export grid as a UTF-8 CSV file. */
export function exportTableToCsv(o: CsvExportOptions): void {
  // Prepend a BOM so spreadsheet apps open the UTF-8 content (Hebrew/Russian) correctly.
  downloadBlob(
    new Blob([BOM + exportGridToCsv(o.grid, o.footer, o.notes)], { type: 'text/csv;charset=utf-8' }),
    o.filename,
  );
}
