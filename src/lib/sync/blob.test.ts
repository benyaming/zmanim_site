import { beforeEach, describe, expect, it } from 'vitest';

import { PREFS_STORAGE_KEY } from '@/components/providers/app-state';
import { A11Y_STORAGE_KEY } from '@/components/providers/accessibility-provider';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { installMemoryLocalStorage } from '@/test/memory-storage';

import {
  applyBlobSections,
  changedSections,
  collectSettingsBlob,
  deserializeSettingsBlob,
  MAX_BLOB_CHARS,
  mergeBlobs,
  observeStamps,
  parseSettingsBlob,
  sectionFingerprint,
  SECTION_NAMES,
  serializeSettingsBlob,
  stampSection,
  type SettingsBlob,
} from './blob';

const EPOCH = new Date(0).toISOString();

beforeEach(() => {
  installMemoryLocalStorage();
  document.documentElement.lang = '';
});

const PREFS = { candleLightingOffset: 22, hiddenZmanim: ['alos'], personalDates: { people: [{ id: 'x', name: 'Test', events: [] }], occasions: [] } };
const A11Y = { fontScale: 'xl', reduceMotion: true, highContrast: false };

function blob(sections: Partial<Record<(typeof SECTION_NAMES)[number], { data: unknown; t: string }>>): SettingsBlob {
  const full = {} as SettingsBlob['sections'];
  for (const name of SECTION_NAMES) full[name] = { data: null, t: EPOCH };
  return { v: 2, sections: { ...full, ...(sections as SettingsBlob['sections']) } };
}

describe('collect / apply', () => {
  it('captures every section with its own stamp', () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(PREFS));
    window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(A11Y));
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.lang = 'he';
    stampSection('theme', '2026-07-20T10:00:00.000Z');
    stampSection('prefs', '2026-07-20T09:00:00.000Z');

    const b = collectSettingsBlob();
    expect(b.sections.prefs.data).toEqual(PREFS);
    expect(b.sections.prefs.t).toBe('2026-07-20T09:00:00.000Z');
    expect(b.sections.a11y.data).toEqual(A11Y);
    expect(b.sections.a11y.t).toBe(EPOCH); // never stamped
    expect(b.sections.theme.data).toBe('dark');
    expect(b.sections.theme.t).toBe('2026-07-20T10:00:00.000Z');
    expect(b.sections.language.data).toBe('he');
  });

  it('writes only the named sections and adopts their stamps; skips language (URL-based)', () => {
    const b = blob({
      prefs: { data: PREFS, t: '2026-07-20T12:00:00.000Z' },
      theme: { data: 'dark', t: '2026-07-20T12:00:00.000Z' },
      language: { data: 'ru', t: '2026-07-20T12:00:00.000Z' },
    });
    applyBlobSections(b, ['prefs', 'theme', 'language']);
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual(PREFS);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    // language is applied by navigation, never written to storage
    expect(collectSettingsBlob().sections.prefs.t).toBe('2026-07-20T12:00:00.000Z');
  });

  it('language defaults to the epoch stamp before any local change', () => {
    expect(collectSettingsBlob().sections.language.t).toBe(EPOCH);
  });
});

describe('Lamport clock (skew resistance)', () => {
  it('stamps a change above every timestamp seen, even a far-future remote one', () => {
    // Simulate having seen a device whose clock runs years ahead.
    const future = '2099-01-01T00:00:00.000Z';
    observeStamps([future]);
    const stamp = stampSection('language');
    expect(Date.parse(stamp)).toBeGreaterThan(Date.parse(future));
  });

  it('issues strictly increasing stamps', () => {
    const a = stampSection('theme');
    const b = stampSection('theme');
    expect(Date.parse(b)).toBeGreaterThan(Date.parse(a));
  });
});

describe('mergeBlobs (per-section, newest wins)', () => {
  it('takes the newest version of each section independently', () => {
    // Device A: newer theme, older language. Device B: the reverse.
    const a = blob({
      theme: { data: 'dark', t: '2026-07-20T12:00:00.000Z' },
      language: { data: 'en', t: '2026-07-20T09:00:00.000Z' },
    });
    const b = blob({
      theme: { data: 'light', t: '2026-07-20T09:00:00.000Z' },
      language: { data: 'he', t: '2026-07-20T12:00:00.000Z' },
    });
    const merged = mergeBlobs([a, b]);
    expect(merged.sections.theme.data).toBe('dark'); // A's newer theme
    expect(merged.sections.language.data).toBe('he'); // B's newer language
  });

  it('breaks an equal-stamp tie deterministically (both devices agree)', () => {
    const SAME = '2026-07-20T12:00:00.000Z';
    const a = blob({ theme: { data: 'dark', t: SAME } });
    const b = blob({ theme: { data: 'light', t: SAME } });
    const winner = sectionFingerprint('theme', 'dark') > sectionFingerprint('theme', 'light') ? 'dark' : 'light';
    expect(mergeBlobs([a, b]).sections.theme.data).toBe(winner);
    expect(mergeBlobs([b, a]).sections.theme.data).toBe(winner); // order-independent
  });

  it('never lets an absent (null) section win over a present value', () => {
    // A partial remote blob (e.g. web_prefs with no language section) carries
    // language {null, EPOCH}. The equal-stamp fingerprint tie-break would pick
    // null ("null" > '"en"'), which the reconcile then "adopts" every mount —
    // an infinite reload, since language lives in the URL, not localStorage.
    const present = blob({ language: { data: 'en', t: EPOCH } });
    const absent = blob({ language: { data: null, t: EPOCH } });
    expect(mergeBlobs([present, absent]).sections.language.data).toBe('en');
    expect(mergeBlobs([absent, present]).sections.language.data).toBe('en'); // order-independent
    // A present value beats an absent one even when the absent side is stamped later.
    const absentLater = blob({ language: { data: null, t: '2099-01-01T00:00:00.000Z' } });
    expect(mergeBlobs([present, absentLater]).sections.language.data).toBe('en');
  });
});

describe('changedSections', () => {
  it('lists sections whose merged content differs from local', () => {
    const local = blob({ theme: { data: 'light', t: EPOCH }, language: { data: 'en', t: EPOCH } });
    const merged = blob({ theme: { data: 'dark', t: '2026-07-20T12:00:00.000Z' }, language: { data: 'en', t: EPOCH } });
    expect(changedSections(local, merged)).toEqual(['theme']);
  });
});

describe('sectionFingerprint', () => {
  it('drops the location label/labelLocale so per-locale relabels do not diverge', () => {
    const en = { location: { lat: 32, lng: 34, label: 'Petah Tikva', labelLocale: 'en' } };
    const he = { location: { lat: 32, lng: 34, label: 'פתח תקווה', labelLocale: 'he' } };
    expect(sectionFingerprint('prefs', en)).toBe(sectionFingerprint('prefs', he));
    // A real coordinate change still shows.
    expect(sectionFingerprint('prefs', { location: { lat: 31, lng: 34 } })).not.toBe(sectionFingerprint('prefs', en));
  });
});

describe('parse / serialize', () => {
  it('roundtrips a collected blob', () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(PREFS));
    const b = collectSettingsBlob();
    const raw = serializeSettingsBlob(b);
    expect(raw).not.toBeNull();
    expect(deserializeSettingsBlob(raw!)).toEqual(b);
  });

  it('migrates a legacy v1 blob into sections sharing its stamp', () => {
    const v1 = { v: 1, updatedAt: '2026-07-19T10:00:00.000Z', prefs: PREFS, a11y: A11Y, theme: 'dark', language: 'ru' };
    const migrated = parseSettingsBlob(v1);
    expect(migrated?.v).toBe(2);
    expect(migrated?.sections.prefs.data).toEqual(PREFS);
    expect(migrated?.sections.theme.data).toBe('dark');
    expect(migrated?.sections.language.data).toBe('ru');
    expect(migrated?.sections.theme.t).toBe('2026-07-19T10:00:00.000Z');
  });

  it('rejects non-blobs and coerces bad section data', () => {
    expect(parseSettingsBlob(null)).toBeNull();
    expect(parseSettingsBlob({ v: 3 })).toBeNull();
    const b = parseSettingsBlob({
      v: 2,
      sections: { prefs: { data: [1, 2], t: 'bad' }, theme: { data: 'sepia', t: EPOCH }, language: { data: 'klingon', t: EPOCH } },
    });
    expect(b?.sections.prefs.data).toBeNull(); // array coerced to null
    expect(b?.sections.prefs.t).toBe(EPOCH); // bad stamp coerced to epoch
    expect(b?.sections.theme.data).toBeNull(); // invalid theme
    expect(b?.sections.language.data).toBeNull(); // invalid language
  });

  it('enforces the size cap', () => {
    const huge = blob({ prefs: { data: { x: 'y'.repeat(MAX_BLOB_CHARS) }, t: EPOCH } });
    expect(parseSettingsBlob(huge)).toBeNull();
  });
});
