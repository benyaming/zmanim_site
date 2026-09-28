import { act, fireEvent, render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';
import { DEFAULT_HIDDEN_FAST_END } from '@/lib/calendar';
import type { IcsExportPreset } from '@/lib/export/ics-preset';
import type { AppLocation } from '@/lib/location';
import { partsFromDay, type PersonalDatesData } from '@/lib/personal-dates';
import { DEFAULT_HAVDALAH_OPINION } from '@/lib/zmanim';

const JERUSALEM: AppLocation = { lat: 31.7683, lng: 35.2137, timeZoneId: 'Asia/Jerusalem', inIsrael: true, label: 'Jerusalem' };
const setIcsExportPreset = vi.fn<(preset: IcsExportPreset) => void>();
const app = vi.hoisted(() => ({
  personalDates: { people: [], occasions: [] } as PersonalDatesData,
  // A short remembered range keeps each build quick.
  preset: { rangeDays: 31 } as IcsExportPreset,
}));

vi.mock('@/components/providers/app-state', () => ({
  useAppState: () => ({
    location: JERUSALEM,
    savedLocations: [],
    candleLightingOffset: 40,
    havdalahOpinion: DEFAULT_HAVDALAH_OPINION,
    hiddenFastEnd: DEFAULT_HIDDEN_FAST_END,
    personalDates: app.personalDates,
    useElevation: false,
    lehumra: false,
    icsExportPreset: app.preset,
    setIcsExportPreset,
  }),
}));
vi.mock('@/lib/export/download', () => ({ downloadBlob: vi.fn(async () => {}) }));
vi.mock('@/lib/export/calendar-events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export/calendar-events')>();
  return { ...actual, buildCalendarEvents: vi.fn(actual.buildCalendarEvents) };
});

const { buildCalendarEvents } = await import('@/lib/export/calendar-events');
const { downloadBlob } = await import('@/lib/export/download');
const { ExportIcsTool } = await import('./export-ics');

const builds = () => vi.mocked(buildCalendarEvents).mock.calls.length;

afterEach(() => {
  vi.clearAllMocks();
  app.personalDates = { people: [], occasions: [] };
  app.preset = { rangeDays: 31 };
});

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ExportIcsTool />
    </NextIntlClientProvider>,
  );

/** The personal events' UIDs in the file handed to the n-th download. */
async function personalUids(n: number): Promise<string[]> {
  const text = await (vi.mocked(downloadBlob).mock.calls[n][0] as Blob).text();
  return [...text.matchAll(/^UID:(personal-[^\r\n]+)/gm)].map((m) => m[1]);
}

describe('ExportIcsTool', () => {
  it('builds once per real change, never for view-only state, and downloads the current selection', async () => {
    show();
    const count = await screen.findByText(/^\d+ events$/);
    const initial = count.textContent;
    expect(builds()).toBe(1);

    // Opening an opinion group changes nothing in the file: no rebuild.
    fireEvent.click(screen.getByRole('button', { name: /Alot ha-Shachar/ }));
    expect(screen.getByRole('button', { name: /Alot ha-Shachar/ })).toHaveAttribute('aria-expanded', 'true');
    expect(builds()).toBe(1);

    // A real change rebuilds exactly once, even across the deferred pass.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Holidays & Rosh Chodesh' }));
    await screen.findByText((text) => /^\d+ events$/.test(text) && text !== initial);
    expect(builds()).toBe(2);

    // Download reuses that build — the current selection, not a stale one.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download .ics' }));
    });
    expect(builds()).toBe(2);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
    expect(filename).toMatch(/^zmanim-calendar-\d{4}-\d{2}\.ics$/);
    expect((blob as Blob).type).toBe('text/calendar;charset=utf-8');
    expect(setIcsExportPreset).toHaveBeenCalledTimes(1);
    expect(setIcsExportPreset.mock.calls[0][0]).toMatchObject({
      rangeDays: 31,
      categories: { candles: true, fasts: true, holidays: false, parsha: true },
      zmanKeys: [],
    });
    // No alerts unless chosen; rounding and elevation are never remembered.
    expect(setIcsExportPreset.mock.calls[0][0].alerts).toEqual({ timed: null, allDay: null });
    expect(await (blob as Blob).text()).not.toContain('VALARM');
    expect(setIcsExportPreset.mock.calls[0][0]).not.toHaveProperty('lehumra');
    expect(setIcsExportPreset.mock.calls[0][0]).not.toHaveProperty('useElevation');
  });

  it('a changed event id is a new build — never a cached file with the old UIDs', async () => {
    // A civil birthday inside the tool's first-use range, which starts on the
    // 1st of the current month. Only the event's id changes between exports:
    // personalDatesFingerprint ignores ids, the build key must not.
    const day = DateTime.now().setZone('Asia/Jerusalem').startOf('month').plus({ days: 9 });
    const anchor = { hebrew: partsFromDay(DateTime.fromObject({ year: day.year - 20, month: day.month, day: day.day })) };
    const withEventId = (id: string): PersonalDatesData => ({
      people: [{ id: 'p', name: 'Dana', events: [{ id, kind: 'birth', anchor }] }],
      occasions: [],
    });
    const download = async () => {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Download .ics' }));
      });
    };

    app.personalDates = withEventId('event-original');
    const view = show();
    await screen.findByText(/^\d+ events$/);
    await download();
    const before = await personalUids(0);
    expect(before.length).toBeGreaterThan(0);

    app.personalDates = withEventId('event-replaced');
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ExportIcsTool />
      </NextIntlClientProvider>,
    );
    await download();
    const after = await personalUids(1);
    expect(after).toHaveLength(before.length);
    expect(after.filter((uid) => before.includes(uid))).toEqual([]);
  });

  it('offers a file over the phone-import limit in parts, each within it, behind a disclosure', async () => {
    app.preset = { rangeDays: 400 }; // ~270 default events in Jerusalem
    show();
    const count = await screen.findByText(/^\d+ events$/);
    const total = Number(count.textContent!.split(' ')[0]);
    expect(total).toBeGreaterThan(200);

    // The whole file stays the main action; the parts wait behind a toggle.
    expect(screen.getByRole('button', { name: 'Download .ics' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /^Part \d of 2 · / })).toHaveLength(0);
    const toggle = screen.getByRole('button', { name: /Download in 2 parts/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const partButtons = screen.getAllByRole('button', { name: /^Part \d of 2 · / });
    expect(partButtons).toHaveLength(2);

    const vevents = async (n: number) =>
      ((await (vi.mocked(downloadBlob).mock.calls[n][0] as Blob).text()).match(/BEGIN:VEVENT/g) ?? []).length;
    await act(async () => {
      fireEvent.click(partButtons[0]);
    });
    await act(async () => {
      fireEvent.click(partButtons[1]);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download .ics' }));
    });
    const names = vi.mocked(downloadBlob).mock.calls.map((call) => call[1]);
    expect(names[0]).toMatch(/-part1-of-2\.ics$/);
    expect(names[1]).toMatch(/-part2-of-2\.ics$/);
    expect(names[2]).toMatch(/^zmanim-calendar-\d{4}-\d{2}\.ics$/);
    const [first, second, whole] = [await vevents(0), await vevents(1), await vevents(2)];
    expect(first).toBeLessThanOrEqual(200);
    expect(second).toBeLessThanOrEqual(200);
    expect(first + second).toBe(whole);
    expect(whole).toBe(total);
  });
});
