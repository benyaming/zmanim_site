import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';

/**
 * The candle-lighting offset field. It is a controlled number input, so it has
 * to tolerate the states a user passes *through* while retyping — above all an
 * empty field. Bound straight to the number, the field snapped back the moment
 * it went empty, so the leading digit could not be deleted and any offset below
 * 10 was practically untypable on a touchscreen.
 */

let offset = 18;
const setCandleLightingOffset = vi.fn((n: number) => {
  offset = n;
});

vi.mock('@/components/providers/app-state', () => ({
  CANDLE_OFFSET_MIN: 1,
  CANDLE_OFFSET_MAX: 120,
  useAppState: () => ({
    location: { lat: 32.08, lng: 34.78, label: 'Tel Aviv', tz: 'Asia/Jerusalem', inIsrael: true },
    candleLightingOffset: offset,
    setCandleLightingOffset,
    useElevation: false,
    setUseElevation: vi.fn(),
    havdalahOpinion: 'tzais_8_5',
    setHavdalahOpinion: vi.fn(),
    lehumra: false,
    setLehumra: vi.fn(),
    hiddenZmanim: [],
    setZmanVisible: vi.fn(),
    showAllZmanim: vi.fn(),
    restoreDefaultZmanim: vi.fn(),
    hiddenLearning: [],
    setLearningVisible: vi.fn(),
    showAllLearning: vi.fn(),
    restoreDefaultLearning: vi.fn(),
    hiddenFastEnd: [],
    setFastEndVisible: vi.fn(),
    showAllFastEnd: vi.fn(),
    restoreDefaultFastEnd: vi.fn(),
  }),
}));

const { CalendarSettingsBody } = await import('./calendar-settings');

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CalendarSettingsBody />
    </NextIntlClientProvider>,
  );

const field = () => screen.getByLabelText(messages.settings.candleOffset) as HTMLInputElement;

beforeEach(() => {
  offset = 18;
  setCandleLightingOffset.mockClear();
});

describe('candle-lighting offset field', () => {
  it('lets the field be emptied so a single-digit offset can be typed', async () => {
    const user = userEvent.setup();
    show();
    await user.clear(field());
    expect(field()).toHaveValue(null); // stays empty instead of snapping back to 18
    await user.type(field(), '5');
    expect(offset).toBe(5);
  });

  it('falls back to the offset in effect when an empty field is abandoned', async () => {
    const user = userEvent.setup();
    show();
    await user.clear(field());
    await user.tab();
    expect(field()).toHaveValue(18);
    expect(setCandleLightingOffset).not.toHaveBeenCalled();
  });

  it('clamps an out-of-range entry on blur rather than while it is typed', async () => {
    const user = userEvent.setup();
    show();
    await user.clear(field());
    await user.type(field(), '150');
    expect(offset).toBe(15); // '150' is out of range: only '1' and '15' took effect
    await user.tab();
    expect(offset).toBe(120);
    expect(field()).toHaveValue(120);
  });
});
