import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCATION } from '@/lib/location';
import { EMPTY_PERSONAL_DATES } from '@/lib/personal-dates';
import { DEFAULT_HAVDALAH_OPINION } from '@/lib/zmanim';

import { buildExportMonth, type ExportMonthCfg } from './export-month';

/** A minimal config with identity labels; override just what a test needs. */
function cfg(over: Partial<ExportMonthCfg>): ExportMonthCfg {
  return {
    locale: 'en',
    location: DEFAULT_LOCATION,
    candleLightingOffset: 18,
    havdalahOpinion: DEFAULT_HAVDALAH_OPINION,
    useElevation: false,
    lehumra: false,
    personalDates: EMPTY_PERSONAL_DATES,
    cellItemKeys: [],
    labels: {
      roshChodesh: 'RC',
      mevarchim: 'Mev',
      omer: (d) => `Omer ${d}`,
      specialShabbat: (n) => n,
      personalName: (obs) => obs.label,
      zmanAbbr: (base) => base,
      learningAbbr: (key) => key,
      zmanLegend: (key) => `legend:${key}`,
      learningName: (key) => `learn:${key}`,
      noTimeNote: 'NOTIME',
      noteElevation: (m) => `elev:${m}`,
      noteLehumra: 'LEHUMRA',
    },
    ...over,
  };
}

describe('buildExportMonth cell items', () => {
  it('renders the chosen zmanim (by base label) in chronological order, whatever the pick order', () => {
    const data = buildExportMonth(
      DateTime.fromISO('2024-03-15'),
      'gregorian',
      cfg({ cellItemKeys: ['sunset', 'sunrise'] }), // deliberately reversed
    );
    const cell = data.cells.find((c) => c.iso === '2024-03-20')!; // equinox, in-month
    expect(cell.items.map((i) => i.label)).toEqual(['sunrise', 'sunset']); // canonical order
    expect(cell.items.every((i) => /\d/.test(i.value))).toBe(true);
    expect(data.legend.map((l) => l.label)).toEqual(['sunrise', 'sunset']);
  });

  it('adds no item lines and an empty legend when nothing is chosen', () => {
    const data = buildExportMonth(DateTime.fromISO('2024-03-15'), 'gregorian', cfg({}));
    expect(data.cells.every((c) => c.items.length === 0)).toBe(true);
    expect(data.legend).toEqual([]);
  });

  it('renders a short-night degree zman as an empty cell value, never a substitute', () => {
    const helsinki = { ...DEFAULT_LOCATION, lat: 60, lng: 25, timeZoneId: 'Europe/Helsinki', inIsrael: false };
    const data = buildExportMonth(
      DateTime.fromISO('2024-06-15'),
      'gregorian',
      cfg({ location: helsinki, cellItemKeys: ['alosHashachar', 'sunset'] }),
    );
    const cell = data.cells.find((c) => c.iso === '2024-06-21')!;
    const alos = cell.items.find((i) => i.label === 'alos')!; // labelled by base
    const shkia = cell.items.find((i) => i.label === 'sunset')!;
    // The 16.1° dawn is unreachable at 60°N in June: no time, and no minute-based
    // stand-in silently printed under the degree opinion's label.
    expect(alos.value).toBe('—');
    expect(/\d/.test(shkia.value)).toBe(true);
  });

  it('supports learning cycles as cell items, after the zmanim', () => {
    const data = buildExportMonth(
      DateTime.fromISO('2024-03-15'),
      'gregorian',
      cfg({ cellItemKeys: ['dafYomi', 'sunrise'] }),
    );
    const cell = data.cells.find((c) => c.iso === '2024-03-20')!;
    expect(cell.items.map((i) => i.label)).toEqual(['sunrise', 'dafYomi']); // zmanim before learnings
    const daf = cell.items.find((i) => i.label === 'dafYomi')!;
    expect(daf.value.length).toBeGreaterThan(0); // a reading
    expect(data.legend.find((l) => l.label === 'dafYomi')?.full).toBe('learn:dafYomi');
  });

  it('notes elevation and lehumra when those options are on', () => {
    const loc = { ...DEFAULT_LOCATION, elevation: 800 };
    const data = buildExportMonth(
      DateTime.fromISO('2024-03-15'),
      'gregorian',
      cfg({ location: loc, useElevation: true, lehumra: true }),
    );
    expect(data.conditions).toBe('elev:800 · LEHUMRA');
  });

  it('has no conditions note when neither option is on', () => {
    const data = buildExportMonth(DateTime.fromISO('2024-03-15'), 'gregorian', cfg({}));
    expect(data.conditions).toBeNull();
  });
});
