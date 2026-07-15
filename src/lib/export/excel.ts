import { downloadBlob } from './download';
import type { ExportGrid } from './grid';

export interface ExcelExportOptions {
  /** The materialized table (already transposed if requested). */
  grid: ExportGrid;
  /** Attribution line appended under the data (and set as the print footer). */
  footer: string;
  /** Compute-option note (elevation / lehumra); empty when none apply. */
  notes?: string;
  /** Right-to-left sheet view (Hebrew UI). */
  rtl: boolean;
  sheetName: string;
  filename: string;
}

/** Column width (in Excel character units) from the print weight and header length. */
function columnWidth(weight: number, header: string): number {
  const byWeight = Math.round(weight * 8);
  const byHeader = Math.min(28, header.length + 2);
  return Math.max(11, byWeight, byHeader);
}

/** Build and download the export grid as an .xlsx workbook. */
export async function exportTableToExcel(o: ExcelExportOptions): Promise<void> {
  // exceljs is CJS — bundlers expose it under `default` (loaded lazily, it's heavy).
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(o.sheetName, {
    views: [{ state: 'frozen', ySplit: 1, rightToLeft: o.rtl }],
    headerFooter: { oddFooter: `&C${o.footer}` },
  });

  sheet.columns = o.grid.headers.map((header, i) => ({
    header,
    width: columnWidth(o.grid.weights[i] ?? 1, header),
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of o.grid.rows) sheet.addRow(row);

  sheet.addRow([]);
  if (o.notes) {
    const noteRow = sheet.addRow([o.notes]);
    noteRow.font = { italic: true, color: { argb: 'FF888888' } };
  }
  const attribution = sheet.addRow([o.footer]);
  attribution.font = { italic: true, color: { argb: 'FF888888' } };

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    o.filename,
  );
}
