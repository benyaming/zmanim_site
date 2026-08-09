import { describe, expect, it } from 'vitest';

import { LEARNING_CYCLE_KEYS } from '@/lib/learning';
import { ZMANIM } from '@/lib/zmanim';

import { COLUMN_KEYS, DEFAULT_EXPORT_RANGE_DAYS, type ExportPreset, sanitizeExportPreset } from './preset';
import { MAX_TABLE_DAYS } from './table';

/** A minimal well-formed saved preset to vary one field at a time. */
const VALID = {
  rangeDays: 31,
  keys: [ZMANIM[0].key],
  learning: ['dafYomi'],
  columns: { date: true, weekday: false },
  transpose: true,
  reportLocale: 'ru',
  locationId: 'loc-1',
  useElevation: true,
  lehumra: true,
};

/** Sanitize and assert it produced something, so field assertions can be terse. */
function parse(raw: unknown): ExportPreset {
  const preset = sanitizeExportPreset(raw);
  expect(preset).not.toBeNull();
  return preset!;
}

describe('sanitizeExportPreset', () => {
  it('reads a well-formed preset back unchanged', () => {
    const preset = parse(VALID);
    expect(preset.rangeDays).toBe(31);
    expect(preset.keys).toEqual([ZMANIM[0].key]);
    expect(preset.learning).toEqual(['dafYomi']);
    expect(preset.transpose).toBe(true);
    expect(preset.reportLocale).toBe('ru');
    expect(preset.locationId).toBe('loc-1');
    expect(preset.useElevation).toBe(true);
    expect(preset.lehumra).toBe(true);
  });

  it('rejects anything that is not a preset', () => {
    // Whatever a store hands back — a stale shape, a partially-written blob, an
    // array from some older format — must read as "no preset", not as a preset
    // full of holes.
    for (const junk of [null, undefined, 0, 'preset', [], [{ keys: [] }], {}, { rangeDays: 31 }]) {
      expect(sanitizeExportPreset(junk), JSON.stringify(junk) ?? 'undefined').toBeNull();
    }
  });

  it('treats an empty selection as a real choice, not as absent', () => {
    // Day columns with no zmanim at all is a legitimate sheet (a plain calendar),
    // so it must survive the round trip instead of reverting to the defaults.
    const preset = parse({ ...VALID, keys: [] });
    expect(preset.keys).toEqual([]);
  });

  it('drops zman keys that no longer exist, and de-duplicates', () => {
    // A preset saved before a zman was renamed or removed would otherwise ask
    // for a column that computes to nothing.
    const preset = parse({ ...VALID, keys: [ZMANIM[0].key, 'sofZmanShmaAtlantis', ZMANIM[0].key] });
    expect(preset.keys).toEqual([ZMANIM[0].key]);
  });

  it('keeps learning cycles in canonical order and drops unknown ones', () => {
    const reversed = [...LEARNING_CYCLE_KEYS].reverse();
    const preset = parse({ ...VALID, learning: [...reversed, 'talmudBavliInOneDay'] });
    expect(preset.learning).toEqual([...LEARNING_CYCLE_KEYS]);
  });

  it('rejects a columns value that is not a real object', () => {
    expect(sanitizeExportPreset({ columns: null })).toBeNull();
    expect(sanitizeExportPreset({ columns: ['date'] })).toBeNull();
  });

  it('keeps only known fast-end opinions, and leaves the field absent when unsaved', () => {
    expect(parse({ ...VALID, fastEnds: ['tzais', 'notAnOpinion', 'tzais72'] }).fastEnds).toEqual(['tzais', 'tzais72']);
    expect(parse(VALID).fastEnds).toBeUndefined();
  });

  it('clamps the remembered range to what the export can actually build', () => {
    expect(parse({ ...VALID, rangeDays: 0 }).rangeDays).toBe(1);
    expect(parse({ ...VALID, rangeDays: -5 }).rangeDays).toBe(1);
    expect(parse({ ...VALID, rangeDays: MAX_TABLE_DAYS + 500 }).rangeDays).toBe(MAX_TABLE_DAYS);
    expect(parse({ ...VALID, rangeDays: 30.6 }).rangeDays).toBe(31);
    for (const bad of [undefined, 'a month', NaN, Infinity]) {
      expect(parse({ ...VALID, rangeDays: bad }).rangeDays).toBe(DEFAULT_EXPORT_RANGE_DAYS);
    }
  });

  it('defaults an unsaved column to on, and keeps an explicit off', () => {
    // The columns are all on for a first export, so a preset that predates a
    // newly-added column should show that column rather than silently hide it.
    const preset = parse({ ...VALID, columns: { date: true, weekday: false } });
    expect(preset.columns.weekday).toBe(false);
    for (const key of COLUMN_KEYS) {
      if (key !== 'weekday') expect(preset.columns[key], `column ${key}`).toBe(true);
    }
  });

  it('falls back on a report language the app does not have', () => {
    expect(parse({ ...VALID, reportLocale: 'fr' }).reportLocale).toBeUndefined();
    expect(parse({ ...VALID, reportLocale: 42 }).reportLocale).toBeUndefined();
    // Absent means "follow the UI language", which is a first export's behaviour.
    expect(parse({ ...VALID, reportLocale: undefined }).reportLocale).toBeUndefined();
  });

  it('falls back to the current location when none was saved', () => {
    expect(parse({ ...VALID, locationId: '' }).locationId).toBe('current');
    expect(parse({ ...VALID, locationId: null }).locationId).toBe('current');
  });

  it('coerces non-boolean flags to their defaults', () => {
    const preset = parse({ ...VALID, transpose: 'yes', useElevation: 1, lehumra: null });
    expect(preset.transpose).toBe(false);
    expect(preset.useElevation).toBe(false);
    expect(preset.lehumra).toBe(false);
  });
});
