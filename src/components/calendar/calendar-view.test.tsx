import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';

let stage = 0;
let coarse = false;
// The stage comes from measuring a real layout; jsdom has none, so the fit is
// fed in here and the arithmetic is tested in use-calendar-nav-stage.test.ts.
vi.mock('@/hooks/use-calendar-nav-stage', () => ({
  useCalendarNavStage: () => ({ rowRef: { current: null }, stage }),
}));
vi.mock('@/hooks/use-coarse-pointer', () => ({ useCoarsePointer: () => coarse }));
// The real provider auto-detects a location on mount; the header only needs the
// viewed month and the mode.
vi.mock('@/components/providers/app-state', () => ({
  useAppState: () => ({
    monthDate: DateTime.fromObject({ year: 2026, month: 9, day: 1 }),
    mode: 'gregorian',
    setMode: vi.fn(),
    setMonthDate: vi.fn(),
    setSelectedDay: vi.fn(),
  }),
}));

const { CalendarView } = await import('./calendar-view');

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CalendarView />
    </NextIntlClientProvider>,
  );

const shown = (label: string) => screen.queryByLabelText(label) !== null;

afterEach(() => {
  stage = 0;
  coarse = false;
});

describe('CalendarView month navigation', () => {
  it('shows both arrow pairs and spells out Today when it all fits', () => {
    stage = 0;
    show();
    expect(['Previous year', 'Previous month', 'Next month', 'Next year'].every(shown)).toBe(true);
    expect(screen.getByLabelText('Today')).toHaveTextContent('Today');
  });

  it('drops the Today label to its icon first, keeping every arrow', () => {
    stage = 1;
    show();
    expect(['Previous year', 'Previous month', 'Next month', 'Next year'].every(shown)).toBe(true);
    // Icon-only, but still named for screen readers.
    expect(screen.getByLabelText('Today')).toHaveTextContent('');
  });

  it('keeps the year jumps on a touch device, where the month is swipeable', () => {
    stage = 2;
    coarse = true;
    show();
    expect(shown('Previous year')).toBe(true);
    expect(shown('Next year')).toBe(true);
    expect(shown('Previous month')).toBe(false);
    expect(shown('Next month')).toBe(false);
    expect(shown('Today')).toBe(true);
  });

  it('keeps the month arrows on a narrow mouse window, which cannot swipe', () => {
    stage = 2;
    coarse = false;
    show();
    expect(shown('Previous month')).toBe(true);
    expect(shown('Next month')).toBe(true);
    expect(shown('Previous year')).toBe(false);
    expect(shown('Next year')).toBe(false);
    expect(shown('Today')).toBe(true);
  });
});
