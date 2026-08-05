'use client';

import type { CSSProperties } from 'react';

import {
  fitColumnWidths,
  HEADER_FONT_SCALE,
  headerRuns,
  PAGE_HEIGHT_PX,
  PAGE_PADDING_PX,
  PAGE_WIDTH_PX,
  SUB_HEADER_FONT_SCALE,
} from '@/lib/export';
import type { ExportDocSheet, ExportGrid } from '@/lib/export';
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
 * One page of the zmanim PDF: a fixed-size A4-landscape sheet with a title
 * band, one fitted table and a footer. The sheet is pre-fitted by the document
 * builder (`buildExportDocument`) — column weights, body font and row padding
 * arrive as data, so this component only draws.
 *
 * The header is two-tier, and each tier holds exactly one kind of thing: tier 1
 * is every column's NAME (spanning its opinions where it has several), tier 2 is
 * the opinion labels — or, on a weekly sheet, the date over its Hebrew date.
 * Nothing crosses between them — no `rowSpan` — so all the names share one
 * baseline and all the opinions share another.
 */
export function ExportTablePage({
  title,
  subtitle,
  pageLabel,
  sheet,
  footer,
  notes,
  dir,
}: {
  /** Sheet heading: what the table is, and where ("Zmanim · Yaroslavl"). */
  title: string;
  /** The month (or week range) this sheet covers, with its part index. */
  subtitle: string;
  /** "3 / 7" — position in the whole document. */
  pageLabel: string;
  sheet: ExportDocSheet;
  /** Attribution line at the bottom of the page. */
  footer: string;
  /** Compute-option note (elevation / lehumra) above the footer; empty when none. */
  notes?: string;
  dir: 'ltr' | 'rtl';
}) {
  return (
    <div
      data-export-page
      dir={dir}
      className="export-light flex flex-col overflow-hidden bg-white font-sans text-neutral-900"
      style={{ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX, padding: PAGE_PADDING_PX }}
    >
      {/* bdi + nowrap: the title mixes scripts (a Hebrew report over a
          Cyrillic place name), and without isolation the bidi algorithm
          scrambles the word order and breaks the name across lines. */}
      <div className="mb-2 flex shrink-0 items-baseline justify-between gap-4">
        <h1 className="text-[15px] leading-none font-semibold tracking-tight whitespace-nowrap">
          <bdi>{title}</bdi>
        </h1>
        <p className="text-[11px] leading-none whitespace-nowrap text-neutral-600">
          <bdi>{subtitle}</bdi>
          <span dir="ltr" className="ms-3 text-neutral-400">
            {pageLabel}
          </span>
        </p>
      </div>

      {sheet.flowGrids ? (
        // A sparse month flowed into side-by-side halves — first half of the
        // month, then the rest — instead of two columns stretched across the
        // whole page with whitespace between them.
        <div className="flex items-start justify-center" style={{ gap: 32 }}>
          {sheet.flowGrids.map((grid, i) => (
            <SheetTable
              key={i}
              grid={grid}
              fontSize={sheet.fontPx}
              rowPadding={sheet.rowPaddingPx}
              tableWidth={sheet.flowWidthPx}
            />
          ))}
        </div>
      ) : (
        <SheetTable grid={sheet.grid} fontSize={sheet.fontPx} rowPadding={sheet.rowPaddingPx} />
      )}

      <div className="mt-auto shrink-0 pt-2">
        {/* Values that occur once or twice a month — the fast bookends, the
            molad — ride here instead of holding a column that is blank on 29
            rows out of 30. */}
        {sheet.footnotes.length > 0 && (
          <p className="pb-[2px] text-center text-[9px] text-neutral-700">{sheet.footnotes.join('   ·   ')}</p>
        )}
        {notes && <p className="pb-[2px] text-center text-[8px] text-neutral-500">{notes}</p>}
        <p className="text-center text-[8px] text-neutral-400">{footer}</p>
      </div>
    </div>
  );
}

/**
 * The fitted table: a two-tier header over the sheet's rows.
 *
 * The rule that divides a name from its opinions is drawn per COLUMN rather than
 * once across a whole base, so each opinion is visibly its own column. It is
 * painted as a clipped background gradient rather than a border: collapsed table
 * borders on adjacent cells merge into one continuous line, which is the thing
 * being avoided, and clipping to the content box leaves the cell's own padding as
 * the gap between neighbouring rules.
 */
function SheetTable({
  grid,
  fontSize,
  rowPadding,
  tableWidth,
}: {
  grid: ExportGrid;
  fontSize: number;
  rowPadding: number;
  /** Fixed table width for a flowed half; full content width when omitted. */
  tableWidth?: number;
}) {
  const runs = headerRuns(grid);
  const hasSubTier = grid.subHeaders.some((sub) => sub !== '');
  // Widths from the fitted per-column weights, so a column is as wide as its
  // longest value needs and no wider. Padding is allocated per column rather
  // than pro-rata — see fitColumnWidths, which exists because the pro-rata
  // version silently truncated clock times on wide sheets.
  const widths = fitColumnWidths(grid.weights, tableWidth).map((f) => `${(f * 100).toFixed(3)}%`);
  const mayWrap = (row: number, col: number) =>
    (grid.proseRows?.[row] === true && !grid.text[col]) ||
    (grid.wrapTextColumns === true && grid.text[col] && col >= (grid.keyColumns ?? 0));

  return (
    <table
      className={cn('table-fixed border-collapse', tableWidth === undefined && 'w-full')}
      style={{ fontSize, lineHeight: 1.35, width: tableWidth }}
    >
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
        {/* The header block always closes with a rule before the body — the
            opinion tier carries it when present, the name tier otherwise. */}
        <tr
          className={cn(!hasSubTier && 'border-b border-neutral-400')}
          style={{ fontSize: fontSize * HEADER_FONT_SCALE }}
        >
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
        {hasSubTier && (
          <tr className="border-b border-neutral-400" style={{ fontSize: fontSize * SUB_HEADER_FONT_SCALE }}>
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
        )}
      </thead>
      <tbody>
        {/* A rule above each Sunday blocks the table into weeks — far easier to
            scan down than zebra striping alone, and it lines up with how the
            sheet is actually read (find the week, then the day). */}
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
                  // A prose cell may wrap; a clock time never does — a time
                  // broken over two lines reads as two numbers. The flag is
                  // structural (see ExportGrid.proseRows), because English times
                  // contain letters and would fool a content check.
                  mayWrap(i, j) ? 'break-words' : 'truncate',
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
