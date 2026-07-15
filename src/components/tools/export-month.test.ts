import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCATION } from '@/lib/location';
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
    customDates: [],
    cellItemKeys: [],
    labels: {
      roshChodesh: 'RC',
      mevarchim: 'Mev',
      omer: (d) => `Omer ${d}`,
      specialShabbat: (n) => n,
      customDate: (k) => k,
      zmanAbbr: (base) => base,
      learningAbbr: (key) => key,
      zmanLegend: (key) => `legend:${key}`,
      learningName: (key) => `learn:${key}`,
      approxNote: 'APPROX',
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
    expect(cell.items.every((i) => !i.approximate)).toBe(true);
    expect(cell.items.every((i) => /\d/.test(i.value))).toBe(true);
    expect(data.approxNote).toBeNull();
    expect(data.legend.map((l) => l.label)).toEqual(['sunrise', 'sunset']);
  });

  it('adds no item lines and an empty legend when nothing is chosen', () => {
    const data = buildExportMonth(DateTime.fromISO('2024-03-15'), 'gregorian', cfg({}));
    expect(data.cells.every((c) => c.items.length === 0)).toBe(true);
    expect(data.legend).toEqual([]);
  });

  it('flags a short-night seasonal-hour fallback and surfaces the footnote', () => {
    const helsinki = { ...DEFAULT_LOCATION, lat: 60, lng: 25, timeZoneId: 'Europe/Helsinki', inIsrael: false };
    const data = buildExportMonth(
      DateTime.fromISO('2024-06-15'),
      'gregorian',
      cfg({ location: helsinki, cellItemKeys: ['alosHashachar', 'sunset'] }),
    );
    const cell = data.cells.find((c) => c.iso === '2024-06-21')!;
    const alos = cell.items.find((i) => i.label === 'alos')!; // labelled by base
    const shkia = cell.items.find((i) => i.label === 'sunset')!;
    expect(alos.approximate).toBe(true); // 16.1° dawn unreachable → seasonal-hour estimate
    expect(shkia.approximate).toBe(false);
    expect(data.approxNote).toBe('APPROX');
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
