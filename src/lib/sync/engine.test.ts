import { beforeEach, describe, expect, it } from 'vitest';

import { PREFS_STORAGE_KEY } from '@/components/providers/app-state';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { installMemoryLocalStorage, installMemorySessionStorage } from '@/test/memory-storage';

import { markUserEdit, SECTION_NAMES, stampSection, type SettingsBlob } from './blob';
import { consumeStartupReload, localizedPath, reconcileTargets, type SyncTarget } from './engine';

const EPOCH = new Date(0).toISOString();

/** An in-memory sync target that records what was pushed to it. */
function memoryTarget(initial: SettingsBlob | null = null) {
  const state = { blob: initial, pushes: [] as SettingsBlob[] };
  const target: SyncTarget = {
    id: 'telegram-bot',
    pull: async () => state.blob,
    push: async (b) => {
      state.blob = b;
      state.pushes.push(b);
      return true;
    },
  };
  return { target, state };
}

/** A blob with the given section overrides; the rest are empty at the epoch. */
function blob(sections: Partial<Record<(typeof SECTION_NAMES)[number], { data: unknown; t: string }>>): SettingsBlob {
  const full = {} as SettingsBlob['sections'];
  for (const name of SECTION_NAMES) full[name] = { data: null, t: EPOCH };
  return { v: 2, sections: { ...full, ...(sections as SettingsBlob['sections']) } };
}

beforeEach(() => {
  installMemoryLocalStorage();
  document.documentElement.lang = '';
});

describe('reconcileTargets', () => {
  it('adopts a newer remote section and writes it locally', async () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 18 }));
    stampSection('prefs', '2026-07-20T10:00:00.000Z');
    const { target } = memoryTarget(
      blob({ prefs: { data: { candleLightingOffset: 40 }, t: '2026-07-20T12:00:00.000Z' } }),
    );

    const { outcome } = await reconcileTargets([target]);
    expect(outcome).toBe('applied');
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 40 });
  });

  it('does NOT let a newer remote theme drag along an older remote language (the reported bug)', async () => {
    // Local: user just set language=he (freshly stamped). Remote (the "PC"):
    // newer theme but a stale language=en.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    document.documentElement.lang = 'he';
    stampSection('language', '2026-07-20T12:00:00.000Z'); // phone's fresh language pick
    const remote = blob({
      theme: { data: 'dark', t: '2026-07-20T13:00:00.000Z' }, // PC's newer theme
      language: { data: 'en', t: '2026-07-20T09:00:00.000Z' }, // PC's stale language
    });
    const { target } = memoryTarget(remote);

    const { outcome, appliedLanguage } = await reconcileTargets([target]);
    // The theme is adopted (remote newer) but language stays 'he' — not reverted.
    expect(outcome).toBe('applied');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(appliedLanguage).toBeNull(); // language section was NOT among those adopted
  });

  it('pushes the merged blob when local holds the newest of every section', async () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 25 }));
    stampSection('prefs', '2026-07-20T15:00:00.000Z');
    const { target, state } = memoryTarget(
      blob({ prefs: { data: { candleLightingOffset: 40 }, t: '2026-07-20T12:00:00.000Z' } }),
    );

    const { outcome } = await reconcileTargets([target]);
    expect(outcome).toBe('pushed');
    expect(state.blob?.sections.prefs.data).toEqual({ candleLightingOffset: 25 });
  });

  it('is clean and does not loop once every section already agrees', async () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 40 }));
    stampSection('prefs', '2026-07-20T12:00:00.000Z');
    const { target, state } = memoryTarget(
      blob({ prefs: { data: { candleLightingOffset: 40 }, t: '2026-07-20T12:00:00.000Z' } }),
    );

    const { outcome } = await reconcileTargets([target]);
    expect(outcome).toBe('clean');
    expect(state.pushes).toHaveLength(0);
  });

  it('ignores a newer remote prefs that differs only in the geocoded location label', async () => {
    window.localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ location: { lat: 32.08, lng: 34.78, label: 'Petah Tikva', labelLocale: 'en' } }),
    );
    stampSection('prefs', '2026-07-20T10:00:00.000Z');
    const { target, state } = memoryTarget(
      blob({
        prefs: {
          data: { location: { lat: 32.08, lng: 34.78, label: 'Петах-Тиква', labelLocale: 'ru' } },
          t: '2026-07-20T12:00:00.000Z',
        },
      }),
    );

    const { outcome } = await reconcileTargets([target]);
    expect(outcome).toBe('clean');
    expect(state.pushes).toHaveLength(0);
  });

  it('does not adopt when allowApply is false', async () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 18 }));
    stampSection('prefs', '2026-07-20T10:00:00.000Z');
    const { target } = memoryTarget(
      blob({ prefs: { data: { candleLightingOffset: 40 }, t: '2026-07-20T12:00:00.000Z' } }),
    );

    const { outcome } = await reconcileTargets([target], { allowApply: false });
    expect(outcome).toBe('clean');
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 18 });
  });

  it('a fresh local edit wins over a higher-stamped remote (clock skew) via the dirty re-stamp', async () => {
    // The reported bug: phone sets language=he now, but the PC's stale en
    // carries a far-future stamp (its clock runs ahead). Without the dirty
    // re-stamp the phone would adopt en back; with it, he wins.
    document.documentElement.lang = 'he';
    markUserEdit('language'); // phone's fresh pick, stamped with the (slow) local clock
    const { target, state } = memoryTarget(
      blob({ language: { data: 'en', t: '2099-01-01T00:00:00.000Z' } }), // PC's future-stamped stale value
    );

    const { outcome, appliedLanguage } = await reconcileTargets([target]);
    expect(appliedLanguage).toBeNull(); // language was NOT adopted from the remote
    expect(outcome).toBe('pushed');
    expect(state.blob?.sections.language.data).toBe('he'); // the phone's pick was pushed out
    expect(Date.parse(state.blob!.sections.language.t)).toBeGreaterThan(Date.parse('2099-01-01T00:00:00.000Z'));
  });

  it('does not adopt (reload) forever when a store lacks the language section', async () => {
    // The reported infinite-reload bug: a logged-in web user on default English
    // whose bot web_prefs blob has no language section -> language {null, EPOCH}.
    // The device's language is 'en' (from the URL) at EPOCH. Adopting the null
    // could never change what the next load reads (language is not in
    // localStorage), so a naive tie-break re-adopts it every mount and reloads.
    document.documentElement.lang = 'en';
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 18 }));
    const { target, state } = memoryTarget(blob({ prefs: { data: { candleLightingOffset: 18 }, t: EPOCH } }));

    const first = await reconcileTargets([target]);
    expect(first.outcome).not.toBe('applied'); // no reload
    expect(first.appliedLanguage).toBeNull();
    // The device fixes the store instead: its real language ('en') is pushed out.
    expect(state.blob?.sections.language.data).toBe('en');

    // A reload cannot change the URL-derived language; a second run must agree.
    document.documentElement.lang = 'en';
    const second = await reconcileTargets([target]);
    expect(second.outcome).toBe('clean');
  });

  it('reports the adopted language so the caller can switch locale', async () => {
    document.documentElement.lang = 'en';
    stampSection('language', '2026-07-20T09:00:00.000Z');
    const { target } = memoryTarget(blob({ language: { data: 'he', t: '2026-07-20T12:00:00.000Z' } }));

    const { outcome, appliedLanguage } = await reconcileTargets([target]);
    expect(outcome).toBe('applied');
    expect(appliedLanguage).toBe('he');
  });
});

describe('consumeStartupReload (startup-reconcile reload guard)', () => {
  beforeEach(() => {
    installMemorySessionStorage();
  });

  it('allows the first startup reload but not a second in the same session', () => {
    // First mount: a newer remote was adopted, so the reconcile reloads once.
    expect(consumeStartupReload()).toBe(true);
    // After the reload, the Mini App re-applies the bot profile and the reconcile
    // wants to adopt+reload again — this is the loop, and the guard blocks it.
    expect(consumeStartupReload()).toBe(false);
    expect(consumeStartupReload()).toBe(false);
  });

  it('grants a fresh reload budget in a new session', () => {
    expect(consumeStartupReload()).toBe(true);
    expect(consumeStartupReload()).toBe(false);
    installMemorySessionStorage(); // a new tab session
    expect(consumeStartupReload()).toBe(true);
  });
});

describe('localizedPath (next-intl as-needed prefixing)', () => {
  it('unprefixes the default locale and prefixes the others', () => {
    expect(localizedPath('/he', 'en')).toBe('/');
    expect(localizedPath('/', 'he')).toBe('/he');
    expect(localizedPath('/ru/zmanim', 'en')).toBe('/zmanim');
    expect(localizedPath('/zmanim', 'ru')).toBe('/ru/zmanim');
    expect(localizedPath('/he/zmanim/jerusalem', 'ru')).toBe('/ru/zmanim/jerusalem');
  });
});
