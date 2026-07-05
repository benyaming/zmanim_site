import { describe, expect, it } from 'vitest';

import { makeLocation } from './location';
import {
  resolveSavedLocation,
  sanitizeSavedLocations,
  type SavedLocation,
  savedLocationDisplayName,
  savedLocationMatches,
} from './saved-locations';

const brooklyn = makeLocation(40.6782, -73.9442, 'Brooklyn', 'en', 12);
const entry = (over: Partial<SavedLocation> = {}): SavedLocation => ({
  id: 'a1',
  name: 'Home',
  location: brooklyn,
  ...over,
});

describe('savedLocationDisplayName', () => {
  it('prefers the custom name and falls back to the geocoded label', () => {
    expect(savedLocationDisplayName(entry())).toBe('Home');
    expect(savedLocationDisplayName(entry({ name: '' }))).toBe('Brooklyn');
    expect(savedLocationDisplayName(entry({ name: '   ' }))).toBe('Brooklyn');
  });
});

describe('resolveSavedLocation', () => {
  it('carries the custom name as customLabel, keeping the geocoded label intact', () => {
    const loc = resolveSavedLocation(entry());
    expect(loc.customLabel).toBe('Home');
    expect(loc.label).toBe('Brooklyn');
    expect(loc.elevation).toBe(12);
  });

  it('leaves customLabel unset for an unnamed entry', () => {
    expect(resolveSavedLocation(entry({ name: ' ' })).customLabel).toBeUndefined();
  });
});

describe('savedLocationMatches', () => {
  it('matches by coordinates only', () => {
    expect(savedLocationMatches(entry(), { lat: 40.6782, lng: -73.9442 })).toBe(true);
    expect(savedLocationMatches(entry(), { lat: 40.6782, lng: -73.9 })).toBe(false);
  });
});

describe('sanitizeSavedLocations', () => {
  it('keeps valid entries', () => {
    const out = sanitizeSavedLocations([entry()]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Home');
    expect(out[0].location.label).toBe('Brooklyn');
    expect(out[0].location.elevation).toBe(12);
  });

  it('drops garbage, malformed entries and duplicate ids', () => {
    expect(sanitizeSavedLocations(undefined)).toEqual([]);
    expect(sanitizeSavedLocations('nope')).toEqual([]);
    expect(
      sanitizeSavedLocations([
        null,
        42,
        { id: 'x' }, // no location
        entry({ id: '' }), // empty id
        { ...entry({ id: 'b' }), location: { ...brooklyn, lat: 91 } }, // out of range
        { ...entry({ id: 'c' }), location: { ...brooklyn, lng: Number.NaN } },
        { ...entry({ id: 'd' }), location: { ...brooklyn, label: '' } },
        entry({ id: 'dup' }),
        entry({ id: 'dup', name: 'Second' }),
      ]),
    ).toHaveLength(1);
  });

  it('heals legacy Israel-area timezones and recomputes inIsrael', () => {
    const legacy = entry({
      id: 'ma',
      location: { lat: 31.7706, lng: 35.2987, timeZoneId: 'Asia/Hebron', label: "Ma'ale Adumim", inIsrael: false },
    });
    const [out] = sanitizeSavedLocations([legacy]);
    expect(out.location.timeZoneId).toBe('Asia/Jerusalem');
    expect(out.location.inIsrael).toBe(true);
  });

  it('drops a non-numeric elevation instead of the whole entry', () => {
    const [out] = sanitizeSavedLocations([{ ...entry(), location: { ...brooklyn, elevation: '12' } }]);
    expect(out.location.elevation).toBeUndefined();
  });
});
