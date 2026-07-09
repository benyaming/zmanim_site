'use client';

import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX, TEXT_DAY_COLUMNS } from '@/lib/export';
import type { DayColumnKey, ZmanimTableRow } from '@/lib/export';
import { cn } from '@/lib/utils';

/** Rows per A4-landscape table page (header + body + footer fill the height). */
export const TABLE_ROWS_PER_PAGE = 25;

/**
 * One page of the zmanim-table PDF: a fixed-size A4-landscape sheet with a
 * title band, a slice of the rows and an attribution footer. Neutral
 * black-on-white styling (tables print; the color theming applies to the grid
 * export). px sizes only — see ExportMonthPage.
 */
export function ExportTablePage({
  title,
  subtitle,
  pageLabel,
  fixedHeaders,
  dayColumns,
  zmanHeaders,
  rows,
  footer,
  dir,
}: {
  title: string;
  subtitle: string;
  /** "3 / 7" page indicator. */
  pageLabel: string;
  fixedHeaders: string[];
  /** Enabled per-day columns (parsha, candle lighting, …) with localized headers. */
  dayColumns: { key: DayColumnKey; header: string }[];
  zmanHeaders: string[];
  rows: ZmanimTableRow[];
  /** Attribution line at the bottom of the page. */
  footer: string;
  dir: 'ltr' | 'rtl';
}) {
  const columns = fixedHeaders.length + dayColumns.length + zmanHeaders.length;
  const fontSize = columns <= 10 ? 'text-[11px]' : columns <= 16 ? 'text-[10px]' : 'text-[9px]';
  // Fixed layout: the four leading columns get stable widths; the parsha
  // column (text, not a time) gets extra room; the rest split evenly.
  const fixedWidths = ['9%', '6%', '10%', '11%'];
  // Text day-columns (parsha, learning readings) get a wider share than time
  // columns; the share is capped so the time columns still get usable width.
  const textCols = dayColumns.filter((c) => TEXT_DAY_COLUMNS.has(c.key));
  const textShare = Math.min(textCols.length * 10, 40);
  const perTextWidth = textCols.length > 0 ? textShare / textCols.length : 0;
  const timeColumns = dayColumns.length - textCols.length + zmanHeaders.length;
  const timeWidth = `${(100 - 36 - textShare) / Math.max(1, timeColumns)}%`;
  const dayColWidth = (key: DayColumnKey) => (TEXT_DAY_COLUMNS.has(key) ? `${perTextWidth}%` : timeWidth);

  return (
    <div
      data-export-page
      dir={dir}
      className="export-light flex flex-col bg-white p-8 font-sans text-neutral-900"
      style={{ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX }}
    >
      <div className="mb-3 flex shrink-0 items-baseline justify-between gap-4">
        <h1 className="text-[20px] leading-none font-semibold tracking-tight">{title}</h1>
        <p className="text-[12px] leading-none text-neutral-600">
          {subtitle} · {pageLabel}
        </p>
      </div>

      <table className={cn('w-full table-fixed border-collapse', fontSize)}>
        <colgroup>
          {fixedWidths.map((width, i) => (
            <col key={`f-${i}`} style={{ width }} />
          ))}
          {dayColumns.map((c) => (
            <col key={`d-${c.key}`} style={{ width: dayColWidth(c.key) }} />
          ))}
          {zmanHeaders.map((_, i) => (
            <col key={`z-${i}`} style={{ width: timeWidth }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b-2 border-neutral-500">
            {[...fixedHeaders, ...dayColumns.map((c) => c.header), ...zmanHeaders].map((header, i) => (
              <th key={i} className="px-1 pb-1 text-start align-bottom font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.iso} className={cn('border-b border-neutral-200', i % 2 === 1 && 'bg-neutral-50')}>
              <td className="truncate px-1 py-[3px] tabular-nums">{row.dateLabel}</td>
              <td className="truncate px-1 py-[3px]">{row.weekday}</td>
              <td className="truncate px-1 py-[3px]">{row.hebrewDate}</td>
              <td className="truncate px-1 py-[3px]">{row.holiday}</td>
              {dayColumns.map((c) => (
                <td key={c.key} className={cn('truncate px-1 py-[3px]', !TEXT_DAY_COLUMNS.has(c.key) && 'tabular-nums')}>
                  {row[c.key]}
                </td>
              ))}
              {row.cells.map((cell, j) => (
                <td key={j} className="truncate px-1 py-[3px] tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-auto shrink-0 pt-2 text-center text-[10px] text-neutral-400">{footer}</p>
    </div>
  );
}
