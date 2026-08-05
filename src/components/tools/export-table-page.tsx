'use client';

import type { CSSProperties } from 'react';

import {
  fitColumnWidths,
  fitRowPadding,
  HEADER_FONT_SCALE,
  headerRuns,
  PAGE_HEIGHT_PX,
  PAGE_PADDING_PX,
  PAGE_WIDTH_PX,
  SUB_HEADER_FONT_SCALE,
} from '@/lib/export';
import type { ExportGrid } from '@/lib/export';
import { cn } from '@/lib/utils';

/**
 * The per-column rule dividing a name from its opinion. Clipped to the content
 * box, so the cell's own horizontal padding becomes the gap to the next column's
 * rule — which is what makes it read as one rule per opinion rather than a single
 * line under the whole base. `neutral-300`, matching the body's rules.
 */
const COLUMN_RULE: CSSProperties = {
  backgroundImage: 'linear-gradient(to bottom, #d4d4d4 1px, transparent 1px)',
  // Origin AND clip, both content-box: clipping alone leaves the gradient
  // starting at the padding edge, so its single lit pixel lands in the padding
  // and is clipped away — an invisible rule. Anchoring the origin to the content
  // box puts that pixel inside the clip, and at the same height in every cell
  // (the padding is uniform), however many lines the opinion wraps to.
  backgroundOrigin: 'content-box',
  backgroundClip: 'content-box',
  backgroundRepeat: 'no-repeat',
};

/**
 * One page of the zmanim-table PDF: a fixed-size A4-landscape sheet with a
 * title band, a slice of the grid and an attribution footer. The grid is
 * pre-materialized (headers + string cells + per-column width/text hints), so
 * this component just lays it out — the same renderer handles the normal and
 * transposed orientations. Neutral black-on-white styling; px sizes only.
 *
 * The header is two-tier, and each tier holds exactly one kind of thing: tier 1
 * is every column's NAME (spanning its opinions where it has several), tier 2 is
 * the opinion labels. Nothing crosses between them — no `rowSpan` — so all the
 * names share one baseline and all the opinions share another, whether or not a
 * given column has opinions at all. A column with none simply leaves tier 2
 * blank; dropping its name down into tier 2 instead is what left "Chatzot" and
 * "Shkia" sitting a line below "Zman Shma" and "Alot ha-Shachar".
 *
 * The rule that divides a name from its opinions is drawn per COLUMN rather than
 * once across a whole base, so each opinion is visibly its own column. It is
 * painted as a clipped background gradient rather than a border: collapsed table
 * borders on adjacent cells merge into one continuous line, which is the thing
 * being avoided, and clipping to the content box leaves the cell's own padding as
 * the gap between neighbouring rules.
 *
 * Column widths and the body font size come from the same fit functions the
 * paginator used, so what is drawn is exactly the layout that was measured to fit.
 */
export function ExportTablePage({
  title,
  subtitle,
  pageLabel,
  blocks,
  fontSize,
  footer,
  notes,
  pageNotes,
  dir,
}: {
  title: string;
  subtitle: string;
  /** "3 / 7" page indicator. */
  pageLabel: string;
  /**
   * Tables stacked down this page. Usually one; a selection too wide for a single
   * row of columns prints the same days two or three times over, each block
   * carrying a different slice of the zmanim, so nothing has to be truncated or
   * moved to another sheet.
   */
  blocks: ExportGrid[];
  /** Body size shared by every block, so the page reads as one sheet. */
  fontSize: number;
  /** Attribution line at the bottom of the page. */
  footer: string;
  /** Compute-option note (elevation / lehumra) above the footer; empty when none. */
  notes?: string;
  /** Once-a-month facts for the days on THIS page: fast bookends, the molad. */
  pageNotes?: string[];
  dir: 'ltr' | 'rtl';
}) {
  return (
    <div
      data-export-page
      dir={dir}
      className="export-light flex flex-col overflow-hidden bg-white font-sans text-neutral-900"
      style={{ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX, padding: PAGE_PADDING_PX }}
    >
      <div className="mb-2 flex shrink-0 items-baseline justify-between gap-4">
        <h1 className="text-[15px] leading-none font-semibold tracking-tight">{title}</h1>
        <p className="text-[10px] leading-none text-neutral-600">
          {subtitle} · {pageLabel}
        </p>
      </div>

      <div className="flex flex-col gap-[10px]">
        {blocks.map((block, i) => (
          <GridBlock key={i} grid={block} fontSize={fontSize} />
        ))}
      </div>

      <div className="mt-auto shrink-0 pt-2">
        {/* Values that occur once or twice a month — the fast bookends, the
            molad — ride here instead of holding a column that is blank on 29
            rows out of 30. */}
        {pageNotes && pageNotes.length > 0 && (
          <p className="pb-[2px] text-center text-[8px] text-neutral-700">{pageNotes.join('   ·   ')}</p>
        )}
        {notes && <p className="pb-[2px] text-center text-[8px] text-neutral-500">{notes}</p>}
        <p className="text-center text-[8px] text-neutral-400">{footer}</p>
      </div>
    </div>
  );
}

/**
 * One table: a two-tier header over a slice of the grid. A page holds one of
 * these normally, or several stacked when the selection is too wide for a single
 * row of columns — each then repeats the day's identity columns beside its own
 * slice of the zmanim.
 */
function GridBlock({ grid, fontSize }: { grid: ExportGrid; fontSize: number }) {
  // Rows stretch to fill whatever vertical slack the (width-driven) font leaves.
  const rowPadding = fitRowPadding(fontSize, grid.rows.length, grid.lineTotal ?? grid.rows.length);
  const runs = headerRuns(grid);
  // Widths from the fitted per-column weights, so a column is as wide as its
  // longest value needs and no wider. Padding is allocated per column rather
  // than pro-rata — see fitColumnWidths, which exists because the pro-rata
  // version silently truncated clock times on wide sheets.
  const widths = fitColumnWidths(grid.weights).map((f) => `${(f * 100).toFixed(3)}%`);

  return (
    <table className="w-full table-fixed border-collapse" style={{ fontSize, lineHeight: 1.35 }}>
      <colgroup>
        {widths.map((width, i) => (
          <col key={i} style={{ width }} />
        ))}
      </colgroup>
      <thead>
        {/* Names: vertically centred, so the band reads as one axis rather than a
            row of captions hanging off the rule. The opinions below stay
            TOP-aligned: that is what holds every rule the same distance from its
            own label. */}
        <tr style={{ fontSize: fontSize * HEADER_FONT_SCALE }}>
          {runs.map((run) => (
            <th
              key={run.start}
              colSpan={run.span}
              className={cn(
                'px-[2px] pb-[3px] align-middle font-semibold break-words',
                // A spanning name centres over its opinions; a lone text column
                // stays flush with its cells.
                grid.text[run.start] && run.span === 1 ? 'text-start' : 'text-center',
              )}
            >
              {run.label}
            </th>
          ))}
        </tr>
        <tr style={{ fontSize: fontSize * SUB_HEADER_FONT_SCALE }}>
          {grid.subHeaders.map((sub, i) => (
            <th
              key={i}
              // EVERY column is ruled, opinion or not: at a uniform height the
              // rules become the header's spine, which is what holds a band of
              // ragged-length captions together.
              //
              // No padding-top: the rule is painted at the content-box edge, so
              // the gap below it belongs to the label, not the cell.
              style={COLUMN_RULE}
              className="px-[2px] pb-[2px] text-center align-top font-normal break-words text-neutral-700"
            >
              {sub && <span className="block pt-[3px]">{sub}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {/* A rule above each Sunday blocks the table into weeks — far easier to
            scan down than zebra striping, and it lines up with how the sheet is
            actually read (find the week, then the day). */}
        {grid.rows.map((row, i) => (
          <tr
            key={i}
            className={cn(
              grid.weekStarts[i] ? 'border-t border-neutral-400' : 'border-t border-neutral-100',
              // Banded rows on top of the week rules: the band tracks the eye
              // across a wide sheet, the rule marks where a week begins.
              i % 2 === 1 && 'bg-neutral-100',
            )}
          >
            {row.map((cell, j) => (
              <td
                key={j}
                style={{ paddingTop: rowPadding, paddingBottom: rowPadding }}
                className={cn(
                  'px-[2px]',
                  // A prose row may wrap; a row of clock times never does — a time
                  // broken over two lines reads as two numbers. The flag is
                  // structural (see ExportGrid.proseRows), because English times
                  // contain letters and would fool a content check.
                  grid.proseRows?.[i] ||
                    (grid.wrapTextColumns && grid.text[j] && j >= (grid.keyColumns ?? 0))
                    ? 'break-words'
                    : 'truncate',
                  grid.text[j] ? 'text-start' : 'text-center tabular-nums',
                  grid.emphasis[j] && cell && 'font-semibold',
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
