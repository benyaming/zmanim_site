import { downloadBlob } from './download';
import type { DayColumnKey, ZmanimTable } from './table';

export interface ExcelExportOptions {
  table: ZmanimTable;
  /** Localized headers for the fixed leading columns (date, weekday, Hebrew date, holiday). */
  fixedHeaders: string[];
  /** Enabled per-day columns (parsha, candle lighting, …) with localized headers. */
  dayColumns: { key: DayColumnKey; header: string }[];
  /** Localized header per table key, aligned with `table.keys`. */
  zmanHeaders: string[];
  /** Attribution line appended under the data (and set as the print footer). */
  footer: string;
  /** Right-to-left sheet view (Hebrew UI). */
  rtl: boolean;
  sheetName: string;
  filename: string;
}

/** Build and download the zmanim table as an .xlsx workbook. */
export async function exportTableToExcel(o: ExcelExportOptions): Promise<void> {
  // exceljs is CJS — bundlers expose it under `default` (loaded lazily, it's heavy).
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(o.sheetName, {
    views: [{ state: 'frozen', ySplit: 1, rightToLeft: o.rtl }],
    headerFooter: { oddFooter: `&C${o.footer}` },
  });

  const headers = [...o.fixedHeaders, ...o.dayColumns.map((c) => c.header), ...o.zmanHeaders];
  const wideCount = o.fixedHeaders.length + o.dayColumns.length;
  sheet.columns = headers.map((header, i) => ({
    header,
    // Date/Hebrew-date/holiday/day-event columns run wider than the time columns.
    width: i === 0 ? 12 : i < wideCount ? 16 : Math.max(11, Math.min(24, header.length + 2)),
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of o.table.rows) {
    sheet.addRow([
      row.dateLabel,
      row.weekday,
      row.hebrewDate,
      row.holiday,
      ...o.dayColumns.map((c) => row[c.key]),
      ...row.cells,
    ]);
  }

  sheet.addRow([]);
  const attribution = sheet.addRow([o.footer]);
  attribution.font = { italic: true, color: { argb: 'FF888888' } };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    o.filename,
  );
}
