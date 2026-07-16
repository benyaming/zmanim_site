import { render as renderBare, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';

import messages from '../../../messages/en.json';
import type { ZmanBaseGroup, ZmanFamily, ZmanGroup, ZmanRow } from '@/lib/zmanim';

import { ZmanimList } from './zmanim-list';

// buildZmanimGroups partitions each base's rows by family; these fixtures are
// hand-built, so derive `families` from `rows` the same way rather than
// restating it — a fixture whose two halves disagree would test nothing real.
// (The partition itself is covered in groups.test.ts.)
const at = (hhmm: string) => DateTime.fromISO(`2024-06-01T${hhmm}:00`, { zone: 'Asia/Jerusalem' });

const FAMILY_ORDER: ZmanFamily[] = [
  'degrees',
  'fixedMinutes',
  'seasonalMinutes',
  'dawnToNightfall',
  'sunriseToSunset',
  'solar',
];
const withFamilies = (item: Omit<ZmanBaseGroup, 'families' | 'grouped' | 'order'>): ZmanBaseGroup => {
  const families = FAMILY_ORDER.filter((f) => item.rows.some((r: ZmanRow) => r.family === f)).map((family) => ({
    family,
    label: `fam:${family}`,
    description: `famDesc:${family}`,
    rows: item.rows.filter((r: ZmanRow) => r.family === family),
  }));
  // `order` drives base layout in buildZmanimGroups, not the rendered list, so a
  // fixed placeholder is fine for these render fixtures.
  return { ...item, order: 0, families, grouped: families.filter((f) => f.rows.length > 1).length >= 2 };
};

// InfoHint reads its aria-label translation, so the tree needs intl context.
const render = (ui: ReactNode) =>
  renderBare(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );

const groups: ZmanGroup[] = [
  {
    category: 'morning',
    label: 'Morning',
    items: [
      withFamilies({
        base: 'sunrise',
        name: 'Sunrise',
        description: 'The ideal time to begin the morning Shema.',
        rows: [{ key: 'sunrise', shita: '', family: 'solar', detail: 'The ideal time to begin the morning Shema.', time: DateTime.fromISO('2024-03-20T05:42:00', { zone: 'Asia/Jerusalem' }) }],
      }),
      withFamilies({
        base: 'tzais',
        name: 'Tzeit ha-Kochavim',
        description: 'Sun 8.5° below the horizon.',
        rows: [{ key: 'tzais', shita: '3 stars · 8.5°', family: 'degrees', detail: 'Sun 8.5° below the horizon.', time: DateTime.fromISO('2024-03-20T18:40:00', { zone: 'Asia/Jerusalem' }) }],
      }),
      withFamilies({
        base: 'shaahZmanis',
        name: 'Astronomical hour',
        description: 'The length of one halachic hour.',
        rows: [
          { key: 'shaahZmanisMGA', shita: 'Magen Avraham (dur)', family: 'dawnToNightfall', detail: '', time: null, durationMillis: 4_530_000 },
          { key: 'shaahZmanisGRA', shita: 'Vilna Gaon (dur)', family: 'sunriseToSunset', detail: '', time: null, durationMillis: null },
        ],
      }),
      withFamilies({
        base: 'sofZmanShma',
        name: 'Latest Shema',
        description: 'Latest time to recite the morning Shema.',
        rows: [
          { key: 'sofZmanShmaMGA', shita: 'Magen Avraham', family: 'dawnToNightfall', detail: 'MGA — dawn to nightfall.', time: DateTime.fromISO('2024-03-20T08:08:00', { zone: 'Asia/Jerusalem' }) },
          { key: 'sofZmanShmaGRA', shita: 'Vilna Gaon', family: 'sunriseToSunset', detail: '', time: null },
        ],
      }),
    ],
  },
];

describe('ZmanimList', () => {
  it('renders a single zman flat, its description behind an info popover', () => {
    render(<ZmanimList groups={groups} />);
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Sunrise')).toBeInTheDocument();
    // The description is tucked behind the name's info button, not shown inline.
    expect(screen.getByRole('button', { name: 'Sunrise — details' })).toBeInTheDocument();
    expect(screen.queryByText('The ideal time to begin the morning Shema.')).not.toBeInTheDocument();
  });

  it('shows a multi-shita zman with description and per-shita detail behind info', () => {
    render(<ZmanimList groups={groups} />);
    expect(screen.getByText('Latest Shema')).toBeInTheDocument();
    expect(screen.getByText('Magen Avraham')).toBeInTheDocument();
    expect(screen.getByText('Vilna Gaon')).toBeInTheDocument();
    // Both the whole-zman description and each opinion detail hide behind info
    // buttons (popovers), so nothing shows inline.
    expect(screen.getByRole('button', { name: 'Latest Shema — details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Magen Avraham — details' })).toBeInTheDocument();
    expect(screen.queryByText('Latest time to recite the morning Shema.')).not.toBeInTheDocument();
    expect(screen.queryByText('MGA — dawn to nightfall.')).not.toBeInTheDocument();
  });

  it('renders a single-shita zman inline: shita next to the name, no indented block', () => {
    render(<ZmanimList groups={groups} />);
    const shita = screen.getByText('3 stars · 8.5°');
    // Name, shita and time all share the one <li> — no nested per-opinion
    // rows like multi-shita zmanim use.
    const row = shita.closest('li')!;
    expect(row).toContainElement(screen.getByText('Tzeit ha-Kochavim'));
    expect(row).toContainElement(screen.getByText(/6:40/));
    expect(row.querySelectorAll('li')).toHaveLength(0);
  });

  it('renders the footnote after the groups when provided, omits it otherwise', () => {
    const { rerender } = render(<ZmanimList groups={groups} footnote="More zmanim in settings." />);
    expect(screen.getByText('More zmanim in settings.')).toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ZmanimList groups={groups} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText('More zmanim in settings.')).not.toBeInTheDocument();
  });

  it('formats a time and shows a dash for a null time', () => {
    render(<ZmanimList groups={groups} />);
    expect(screen.getByText(/5:42/)).toBeInTheDocument();
    // One dash for the null-time row, one for the null-duration row.
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  /** A multi-family Alot, as a short-night location produces (cf. Düsseldorf). */
  const alot = (rows: ZmanRow[]): ZmanGroup[] => [
    {
      category: 'dawn',
      label: 'Dawn',
      items: [withFamilies({ base: 'alos', name: 'Alot ha-Shachar', description: 'Dawn.', rows })],
    },
  ];

  it('groups a multi-family zman under a heading per calculation method', () => {
    render(
      <ZmanimList
        groups={alot([
          { key: 'alos198', shita: '19.8°', family: 'degrees', detail: '', time: at('03:20') },
          { key: 'alosHashachar', shita: '16.1°', family: 'degrees', detail: '', time: at('04:30') },
          { key: 'alos90', shita: '90 min', family: 'fixedMinutes', detail: '', time: at('03:52') },
          { key: 'alos72', shita: '72 min', family: 'fixedMinutes', detail: '', time: at('04:10') },
          { key: 'alos72Zmanis', shita: '72 zmaniyos', family: 'seasonalMinutes', detail: '', time: at('03:43') },
        ])}
      />,
    );
    // One heading per family, in canonical order — NOT interleaved by time
    // (04:10 fixed would otherwise sort above the 04:30 degree row).
    const headings = screen.getAllByText(/^fam:/).map((e) => e.textContent);
    expect(headings).toEqual(['fam:degrees', 'fam:fixedMinutes', 'fam:seasonalMinutes']);
    // Each heading explains what its method measures.
    expect(screen.getByRole('button', { name: 'fam:seasonalMinutes — details' })).toBeInTheDocument();
  });

  const NOTE = 'The sun never gets that low here.';

  it('shows the blank caption once per family when the family has any blank', () => {
    render(
      <ZmanimList
        groups={alot([
          // Short night: both degree rows blank; the two fixed rows make it group.
          { key: 'alosHashachar', shita: '16.1°', family: 'degrees', detail: '', time: null },
          { key: 'alos18', shita: '18°', family: 'degrees', detail: '', time: null },
          { key: 'alos90', shita: '90 min', family: 'fixedMinutes', detail: '', time: at('03:52') },
          { key: 'alos72', shita: '72 min', family: 'fixedMinutes', detail: '', time: at('04:10') },
        ])}
        noDegreeTimeNote={NOTE}
      />,
    );
    // One visible caption for the blank degrees family — not per row, and not on
    // the fixed-minute family (which has times).
    expect(screen.getAllByText(NOTE)).toHaveLength(1);
    // The family headings still carry their method description.
    expect(screen.getByRole('button', { name: 'fam:degrees — details' })).toBeInTheDocument();
  });

  it('shows the caption for a partially-blank family too (some rows have times)', () => {
    render(
      <ZmanimList
        groups={alot([
          { key: 'alos198', shita: '19.8°', family: 'degrees', detail: '', time: at('03:20') },
          { key: 'alosHashachar', shita: '16.1°', family: 'degrees', detail: '', time: null },
          { key: 'alos90', shita: '90 min', family: 'fixedMinutes', detail: '', time: at('03:52') },
          { key: 'alos72', shita: '72 min', family: 'fixedMinutes', detail: '', time: at('04:10') },
        ])}
        noDegreeTimeNote={NOTE}
      />,
    );
    // The degrees family has one blank (16.1°) → one caption; the real 19.8° and
    // the fixed family need none.
    expect(screen.getAllByText(NOTE)).toHaveLength(1);
  });

  it('captions a blank day-fraction opinion whose degree boundary is unreached', () => {
    // Sof zman Shma's Magen Avraham variants measure from a degree-based dawn, so
    // on a short night they go null too — despite being family `dawnToNightfall`,
    // not `degrees`. The caption still appears for that family.
    render(
      <ZmanimList
        groups={[
          {
            category: 'morning',
            label: 'Morning',
            items: [
              withFamilies({
                base: 'sofZmanShma',
                name: 'Latest Shema',
                description: 'Latest Shema.',
                rows: [
                  { key: 'sofZmanShmaMGA18', shita: 'MGA 18°', family: 'dawnToNightfall', detail: '', time: null },
                  { key: 'sofZmanShmaMGA161', shita: 'MGA 16.1°', family: 'dawnToNightfall', detail: '', time: null },
                  { key: 'sofZmanShmaGRA', shita: 'Vilna Gaon', family: 'sunriseToSunset', detail: '', time: at('08:44') },
                  { key: 'sofZmanShmaBaalHatanya', shita: 'Baal HaTanya', family: 'sunriseToSunset', detail: '', time: at('08:42') },
                ],
              }),
            ],
          },
        ]}
        noDegreeTimeNote={NOTE}
      />,
    );
    // One caption for the blank dawn-to-nightfall family; the GRA day resolves.
    expect(screen.getAllByText(NOTE)).toHaveLength(1);
    expect(screen.getByText(/8:44/)).toBeInTheDocument();
  });

  it('captions an all-blank flat (non-grouped) base once, not per row', () => {
    // Misheyakir is single-family (all degrees) so it never groups. At a very
    // high latitude every opinion is blank; one caption for the base, not five.
    render(
      <ZmanimList
        groups={[
          {
            category: 'dawn',
            label: 'Dawn',
            items: [
              withFamilies({
                base: 'misheyakir',
                name: 'Misheyakir',
                description: 'Earliest tallit & tefillin.',
                rows: [
                  { key: 'misheyakir115', shita: '11.5°', family: 'degrees', detail: '', time: null },
                  { key: 'misheyakir11', shita: '11°', family: 'degrees', detail: '', time: null },
                  { key: 'misheyakir102', shita: '10.2°', family: 'degrees', detail: '', time: null },
                ],
              }),
            ],
          },
        ]}
        noDegreeTimeNote={NOTE}
      />,
    );
    expect(screen.getAllByText(NOTE)).toHaveLength(1);
    expect(screen.getAllByText('—')).toHaveLength(3);
    // The base keeps its own description hint (the caption is separate inline text).
    expect(screen.getByRole('button', { name: 'Misheyakir — details' })).toBeInTheDocument();
  });

  it('captions the everyday single-opinion default when it is blank', () => {
    // The default panel shows one Alot (16.1°). At Düsseldorf it is null, so the
    // one-line row must still explain its own dash — the case a default user hits.
    render(
      <ZmanimList
        groups={[
          {
            category: 'dawn',
            label: 'Dawn',
            items: [
              withFamilies({
                base: 'alos',
                name: 'Alot ha-Shachar',
                description: 'Dawn.',
                rows: [{ key: 'alosHashachar', shita: '16.1°', family: 'degrees', detail: '', time: null }],
              }),
            ],
          },
        ]}
        noDegreeTimeNote={NOTE}
      />,
    );
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('suppresses the caption entirely when the note is empty (polar day)', () => {
    render(
      <ZmanimList
        groups={alot([{ key: 'alosHashachar', shita: '16.1°', family: 'degrees', detail: '', time: null }])}
        noDegreeTimeNote=""
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('groups Sof zman Shma by day-definition, where the arithmetic is identical', () => {
    // All six opinions are "a fraction of the day" — they differ only over WHICH
    // day. The split is by dawn-to-nightfall (Magen Avraham) vs sunrise-to-sunset
    // (Vilna Gaon / Baal HaTanya), which is the 35-minute machloket that matters.
    render(
      <ZmanimList
        groups={[
          {
            category: 'morning',
            label: 'Morning',
            items: [
              withFamilies({
                base: 'sofZmanShma',
                name: 'Latest Shema',
                description: 'Latest Shema.',
                rows: [
                  { key: 'sofZmanShmaMGA90', shita: 'MGA 90', family: 'dawnToNightfall', detail: '', time: at('07:59') },
                  { key: 'sofZmanShmaMGA', shita: 'MGA 72', family: 'dawnToNightfall', detail: '', time: at('08:08') },
                  { key: 'sofZmanShmaBaalHatanya', shita: 'Baal HaTanya', family: 'sunriseToSunset', detail: '', time: at('08:42') },
                  { key: 'sofZmanShmaGRA', shita: 'Vilna Gaon', family: 'sunriseToSunset', detail: '', time: at('08:44') },
                ],
              }),
            ],
          },
        ]}
      />,
    );
    const headings = screen.getAllByText(/^fam:/).map((e) => e.textContent);
    expect(headings).toEqual(['fam:dawnToNightfall', 'fam:sunriseToSunset']);
  });

  it('stays flat when only one family has multiple opinions (Mincha Gedola)', () => {
    // Three sunrise-to-sunset opinions plus a lone fixed-30 and a lone MGA. Only
    // one family is multi-opinion, so headings would be noise — the panel keeps
    // the flat chronological list. (Opinions here sit within ~6 minutes.)
    render(
      <ZmanimList
        groups={[
          {
            category: 'afternoon',
            label: 'Afternoon',
            items: [
              withFamilies({
                base: 'minchaGedola',
                name: 'Mincha Gedola',
                description: 'Earliest Mincha.',
                rows: [
                  { key: 'minchaGedola30', shita: '30 min', family: 'fixedMinutes', detail: '', time: at('12:16') },
                  { key: 'minchaGedola', shita: 'Vilna Gaon', family: 'sunriseToSunset', detail: '', time: at('12:17') },
                  { key: 'minchaGedolaBaalHatanya', shita: 'Baal HaTanya', family: 'sunriseToSunset', detail: '', time: at('12:17') },
                  { key: 'minchaGedola161', shita: 'MGA 16.1°', family: 'dawnToNightfall', detail: '', time: at('12:23') },
                ],
              }),
            ],
          },
        ]}
      />,
    );
    expect(screen.queryByText(/^fam:/)).not.toBeInTheDocument();
    // Every opinion still shows, just without headings.
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('MGA 16.1°')).toBeInTheDocument();
  });

  it('stays flat, with no family heading, when a zman has only one family', () => {
    // Misheyakir is all-degrees: a "By sun angle" heading over every row would
    // restate what the rows already say.
    render(
      <ZmanimList
        groups={alot([
          { key: 'misheyakir115', shita: '11.5°', family: 'degrees', detail: '', time: at('04:52') },
          { key: 'misheyakir102', shita: '10.2°', family: 'degrees', detail: '', time: at('04:58') },
        ])}
      />,
    );
    expect(screen.queryByText(/^fam:/)).not.toBeInTheDocument();
  });

  it('leaves blanks unexplained when no note is supplied', () => {
    render(<ZmanimList groups={groups} noDegreeTimeNote="" />);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('renders a duration row as h:mm:ss, not a clock time, and dashes a null duration', () => {
    render(<ZmanimList groups={groups} />);
    expect(screen.getByText('1:15:30')).toBeInTheDocument();
    // The null-duration shita row shows a dash (asserted above alongside the null time).
    expect(screen.getByText('Vilna Gaon (dur)')).toBeInTheDocument();
  });
});
