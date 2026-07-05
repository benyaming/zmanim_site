import { render as renderBare, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';

import messages from '../../../messages/en.json';
import type { ZmanGroup } from '@/lib/zmanim';

import { ZmanimList } from './zmanim-list';

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
      {
        base: 'sunrise',
        name: 'Sunrise',
        description: 'The ideal time to begin the morning Shema.',
        rows: [{ key: 'sunrise', shita: '', detail: 'The ideal time to begin the morning Shema.', time: DateTime.fromISO('2024-03-20T05:42:00', { zone: 'Asia/Jerusalem' }) }],
      },
      {
        base: 'tzais',
        name: 'Tzeit ha-Kochavim',
        description: 'Sun 8.5° below the horizon.',
        rows: [{ key: 'tzais', shita: '3 stars · 8.5°', detail: 'Sun 8.5° below the horizon.', time: DateTime.fromISO('2024-03-20T18:40:00', { zone: 'Asia/Jerusalem' }) }],
      },
      {
        base: 'shaahZmanis',
        name: 'Astronomical hour',
        description: 'The length of one halachic hour.',
        rows: [
          { key: 'shaahZmanisMGA', shita: 'Magen Avraham (dur)', detail: '', time: null, durationMillis: 4_530_000 },
          { key: 'shaahZmanisGRA', shita: 'Vilna Gaon (dur)', detail: '', time: null, durationMillis: null },
        ],
      },
      {
        base: 'sofZmanShma',
        name: 'Latest Shema',
        description: 'Latest time to recite the morning Shema.',
        rows: [
          { key: 'sofZmanShmaMGA', shita: 'Magen Avraham', detail: 'MGA — dawn to nightfall.', time: DateTime.fromISO('2024-03-20T08:08:00', { zone: 'Asia/Jerusalem' }) },
          { key: 'sofZmanShmaGRA', shita: 'Vilna Gaon', detail: '', time: null },
        ],
      },
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

  it('renders a duration row as h:mm:ss, not a clock time, and dashes a null duration', () => {
    render(<ZmanimList groups={groups} />);
    expect(screen.getByText('1:15:30')).toBeInTheDocument();
    // The null-duration shita row shows a dash (asserted above alongside the null time).
    expect(screen.getByText('Vilna Gaon (dur)')).toBeInTheDocument();
  });
});
