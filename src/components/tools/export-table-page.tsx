'use client';

import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX } from '@/lib/export';
import type { ExportGrid } from '@/lib/export';
import { cn } from '@/lib/utils';

/**
 * One page of the zmanim-table PDF: a fixed-size A4-landscape sheet with a
 * title band, a slice of the grid and an attribution footer. The grid is
 * pre-materialized (headers + string cells + per-column width/text hints), so
 * this component just lays it out — the same renderer handles the normal and
 * transposed orientations. Neutral black-on-white styling; px sizes only.
 */
export function ExportTablePage({
  title,
  subtitle,
  pageLabel,
  grid,
  footer,
  notes,
  dir,
}: {
  title: string;
  subtitle: string;
  /** "3 / 7" page indicator. */
  pageLabel: string;
  grid: ExportGrid;
  /** Attribution line at the bottom of the page. */
  footer: string;
  /** Compute-option note (elevation / lehumra) above the footer; empty when none. */
  notes?: string;
  dir: 'ltr' | 'rtl';
}) {
  const columns = grid.headers.length;
  const fontSize = columns <= 10 ? 'text-[11px]' : columns <= 16 ? 'text-[10px]' : columns <= 26 ? 'text-[9px]' : 'text-[8px]';
  // Proportional widths from the per-column weights (text columns are wider),
  // so every column gets a fair share and headers wrap cleanly instead of
  // colliding — no more starved time columns or overlapping titles.
  const totalWeight = grid.weights.reduce((sum, w) => sum + w, 0) || 1;
  const widths = grid.weights.map((w) => `${((w / totalWeight) * 100).toFixed(3)}%`);

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
          {widths.map((width, i) => (
            <col key={i} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b-2 border-neutral-500">
            {grid.headers.map((header, i) => (
              <th key={i} className="px-1 pb-1 text-start align-bottom font-semibold leading-tight break-words">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, i) => (
            <tr key={i} className={cn('border-b border-neutral-200', i % 2 === 1 && 'bg-neutral-50')}>
              {row.map((cell, j) => (
                <td key={j} className={cn('truncate px-1 py-[3px]', !grid.text[j] && 'tabular-nums')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-auto shrink-0 pt-2">
        {notes && <p className="pb-[2px] text-center text-[10px] text-neutral-500">{notes}</p>}
        <p className="text-center text-[10px] text-neutral-400">{footer}</p>
      </div>
    </div>
  );
}
