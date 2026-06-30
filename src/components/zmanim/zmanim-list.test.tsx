import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import type { ZmanGroup } from '@/lib/zmanim';

import { ZmanimList } from './zmanim-list';

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
  it('renders a single zman flat with its description', () => {
    render(<ZmanimList groups={groups} />);
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Sunrise')).toBeInTheDocument();
    expect(screen.getByText('The ideal time to begin the morning Shema.')).toBeInTheDocument();
  });

  it('shows a multi-shita zman with a whole-zman caption and per-shita info', () => {
    render(<ZmanimList groups={groups} />);
    expect(screen.getByText('Latest Shema')).toBeInTheDocument();
    // The visible caption describes the whole zman.
    expect(screen.getByText('Latest time to recite the morning Shema.')).toBeInTheDocument();
    expect(screen.getByText('Magen Avraham')).toBeInTheDocument();
    expect(screen.getByText('Vilna Gaon')).toBeInTheDocument();
    // The opinion-specific detail lives behind an info button (popover), not inline.
    expect(screen.getByRole('button', { name: 'Magen Avraham — details' })).toBeInTheDocument();
    expect(screen.queryByText('MGA — dawn to nightfall.')).not.toBeInTheDocument();
  });

  it('formats a time and shows a dash for a null time', () => {
    render(<ZmanimList groups={groups} />);
    expect(screen.getByText(/5:42/)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
