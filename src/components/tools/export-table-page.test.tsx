import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildExportGrid, type ExportDocSheet, type ExportGrid } from '@/lib/export';

import { ExportTablePage } from './export-table-page';

/**
 * The print sheet's header structure. jsdom has no layout, so these assert the
 * DOM invariants the alignment depends on rather than pixel positions — which is
 * the durable form: the reported misalignment came from a column's NAME sometimes
 * living in tier 1 and sometimes in tier 2, so pinning "tier 1 is names, tier 2
 * is opinions, nothing crosses" is pinning the fix itself.
 */

/** A grid shaped like a real sheet: lone columns, a 3-opinion base, a 1-opinion base. */
function sheet(): ExportGrid {
  const grid = buildExportGrid(
    {
      keys: [],
      rows: [
        {
          iso: '2026-01-04',
          dateLabel: '4/1/2026',
          dayWithMonth: '4 Jan',
          weekday: 'Sun',
          hebrewDate: '15 Tevet',
          holiday: '',
          parsha: 'Shemot',
          candleLighting: '16:20',
          havdalah: '17:30',
          fastStart: '',
          fastEnd: '',
          mevarchim: '',
          mevarchimName: '',
          molad: '',
          omer: '',
          cells: ['06:01', '06:02', '06:03', '11:30', '12:00'],
        } as never,
      ],
    },
    [
      { key: 'events', header: 'Holiday / Parsha', fields: ['holiday', 'parsha'] },
      { key: 'candleLighting', header: 'Candle lighting', emphasis: true },
    ],
    [
      { label: 'Latest Shema', sub: 'Magen Avraham 90 min', group: 'sofZmanShma' },
      { label: 'Latest Shema', sub: 'Baal HaTanya', group: 'sofZmanShma' },
      { label: 'Latest Shema', sub: 'Vilna Gaon', group: 'sofZmanShma' },
      // A base with several opinions of which only ONE is selected: it still
      // needs its name in tier 1 and its opinion in tier 2.
      { label: 'Mincha Gedola', sub: 'Vilna Gaon', group: 'minchaGedola' },
      { label: 'Chatzot' },
    ],
  );
  return grid;
}

function docSheet(grid: ExportGrid): ExportDocSheet {
  return {
    kind: 'times',
    grid,
    fontPx: 10,
    rowPaddingPx: 2,
    startIso: '2026-01-04',
    endIso: '2026-01-04',
    part: 1,
    parts: 1,
    footnotes: [],
  };
}

function renderSheet() {
  const { container } = render(
    <ExportTablePage
      title="Zmanim"
      subtitle="Jan 2026"
      pageLabel="1 / 1"
      sheet={docSheet(sheet())}
      footer="zmanim.example"
      dir="ltr"
    />,
  );
  const rows = container.querySelectorAll('thead tr');
  return { container, tier1: rows[0], tier2: rows[1], rows };
}

describe('ExportTablePage header', () => {
  it('puts every column’s NAME in tier 1, on one baseline', () => {
    const { tier1 } = renderSheet();
    const cells = [...tier1.querySelectorAll('th')];
    // Every column is named here — including the ones with no opinion below,
    // which is what keeps "Chatzot" level with "Latest Shema" instead of a line
    // below it. A base spans the opinions it covers.
    expect(cells.map((c) => [c.textContent, c.getAttribute('colspan')])).toEqual([
      ['Holiday / Parsha', '1'],
      ['Candle lighting', '1'],
      ['Latest Shema', '3'],
      ['Mincha Gedola', '1'],
      ['Chatzot', '1'],
    ]);
    // Centred in the tier, so the names read as one band whatever their length.
    for (const cell of cells) {
      expect(cell.className).toContain('align-middle');
    }
  });

  it('hangs every opinion from the top of tier 2, under its own rule', () => {
    const { tier2, container } = renderSheet();
    const columnCount = container.querySelectorAll('colgroup col').length;
    const cells = [...tier2.querySelectorAll('th')];
    // One cell per column — no gaps left by a neighbour spanning down into this
    // row — and blank wherever the column has no opinion to name.
    expect(cells).toHaveLength(columnCount);
    expect(cells.map((c) => c.textContent)).toEqual([
      '',
      '',
      'Magen Avraham 90 min',
      'Baal HaTanya',
      'Vilna Gaon',
      'Vilna Gaon',
      '',
    ]);
    // Top-aligned, so a one-line opinion stays attached to the name above it
    // rather than dropping to the foot of a tier sized by the tallest label.
    for (const cell of cells) {
      expect(cell.className).toContain('align-top');
      expect(cell.className).not.toContain('align-bottom');
    }
  });

  it('never spans a header cell across both tiers', () => {
    // rowSpan=2 was the old mechanism, and the original cause of the drift.
    const { container } = renderSheet();
    for (const th of container.querySelectorAll('thead th')) {
      expect(th.getAttribute('rowspan')).toBeNull();
    }
  });

  it('rules every column separately, not once across a base', () => {
    // One rule per column, including the columns with no opinion under them: at a
    // uniform height they form the header's spine. A single border spanning a base
    // would collapse its columns' rules into one line, which is what's avoided.
    const { tier2 } = renderSheet();
    const ruled = [...tier2.querySelectorAll('th')].map((c) => (c as HTMLElement).style.backgroundImage !== '');
    expect(ruled).toEqual([true, true, true, true, true, true, true]);
    for (const th of tier2.querySelectorAll('th')) {
      const style = (th as HTMLElement).style;
      if (!style.backgroundImage) continue;
      // Both, or the rule is clipped into invisibility — see COLUMN_RULE.
      expect(style.backgroundClip).toBe('content-box');
      expect(style.backgroundOrigin).toBe('content-box');
    }
  });

  it('draws no vertical rules anywhere', () => {
    // Column seams were never asked for; the horizontal per-opinion rule is the
    // only division the sheet carries.
    const { container } = renderSheet();
    for (const cell of container.querySelectorAll('th, td')) {
      expect(cell.className).not.toContain('border-s');
      expect(cell.className).not.toContain('border-e');
    }
  });

  it('omits the opinion tier entirely on a sheet with no opinions (a learning sheet)', () => {
    const grid = buildExportGrid(
      { keys: [], rows: [] },
      [
        { key: 'dayWithMonth', header: 'Date', identity: true },
        { key: 'dafYomi', header: 'Daf Yomi' },
      ],
      [],
    );
    const { container } = render(
      <ExportTablePage
        title="Learning"
        subtitle="Jan 2026"
        pageLabel="1 / 1"
        sheet={docSheet(grid)}
        footer="zmanim.example"
        dir="ltr"
      />,
    );
    expect(container.querySelectorAll('thead tr')).toHaveLength(1);
  });

  it('prints the sheet footnotes as labelled blocks above the attribution', () => {
    const { container } = render(
      <ExportTablePage
        title="Zmanim"
        subtitle="Jul 2026"
        pageLabel="1 / 1"
        sheet={{
          ...docSheet(sheet()),
          footnotes: [
            {
              label: 'Fast of Tammuz',
              text: '',
              groups: [
                { heading: 'starts', pairs: [{ label: '', time: '4:12' }] },
                { heading: 'ends', pairs: [{ label: '3 stars', time: '20:11' }] },
              ],
            },
            { label: 'Molad Av', text: 'Monday, 12:54' },
          ],
        }}
        footer="zmanim.example"
        calculation={{
          label: 'Calculation',
          text: '',
          groups: [{ heading: 'Candles', pairs: [{ label: '', time: '18 min before shkia' }] }],
        }}
        dir="ltr"
      />,
    );
    expect(container.textContent).toContain('Fast of Tammuz');
    expect(container.textContent).toContain('starts');
    expect(container.textContent).toContain('4:12');
    expect(container.textContent).toContain('3 stars');
    expect(container.textContent).toContain('20:11');
    expect(container.textContent).toContain('Molad Av');
    expect(container.textContent).toContain('Calculation');
    expect(container.textContent).toContain('Candles');
    expect(container.textContent).toContain('18 min before shkia');
  });
});
