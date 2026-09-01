import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PREFS_STORAGE_KEY } from '@/components/providers/app-state';
import { A11Y_STORAGE_KEY } from '@/components/providers/accessibility-provider';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { installMemoryLocalStorage, installMemorySessionStorage } from '@/test/memory-storage';

import {
  dirtySections,
  lineageAccount,
  recordSyncedPrefs,
  sectionFingerprint,
  markUserEdit,
  PULL_FAILED,
  recordLineage,
  SECTION_NAMES,
  stampSection,
  type SettingsBlob,
} from './blob';
import {
  adoptAccountSettings,
  consumeStartupReload,
  keepDeviceSettings,
  localizedPath,
  reconcileTargets,
  type SyncTarget,
} from './engine';

const EPOCH = new Date(0).toISOString();

/** An in-memory sync target that records what was pushed to it. */
function memoryTarget(
  initial: SettingsBlob | null = null,
  account: string | null = null,
  id: SyncTarget['id'] = 'telegram-bot',
) {
  const state = { blob: initial, pushes: [] as SettingsBlob[] };
  const target: SyncTarget = {
    id,
    account,
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

/** A target whose pull failed (couldn't read the store); records push attempts. */
function failedPullTarget() {
  const pushes: SettingsBlob[] = [];
  const target: SyncTarget = {
    id: 'google-websync',
    account: null,
    pull: async () => PULL_FAILED,
    push: async (b) => {
      pushes.push(b);
      return true;
    },
  };
  return { target, pushes };
}

describe('reconcileTargets', () => {
  it('never pushes over a store whose pull failed', async () => {
    // The data-loss guard: a fresh device with default local settings must not
    // overwrite a store it couldn't read (its remote copy may be the only one).
    const { target, pushes } = failedPullTarget();

    const result = await reconcileTargets([target]);

    expect(pushes).toEqual([]); // nothing pushed to the unreadable store
    expect(result.outcome).toBe('none'); // all targets unreachable → reported as failure, not "synced"
  });

  it('still pushes to a readable store when another target failed to pull', async () => {
    const failed = failedPullTarget();
    const readable = memoryTarget(null); // reachable, empty
    markUserEdit('theme');

    await reconcileTargets([failed.target, readable.target]);

    expect(failed.pushes).toEqual([]); // skipped — unreadable
    expect(readable.state.pushes.length).toBe(1); // the empty-but-reachable store gets the local blob
  });

  it('keeps an edit dirty when any target was unreadable, even after a push elsewhere', async () => {
    // The multi-store data-loss guard: pushing to a reachable store must NOT
    // clear dirty while another store was unreadable, or when that store comes
    // back holding a higher-stamped stale value the edit is no longer re-stamped
    // and gets reverted and propagated back out.
    const failed = failedPullTarget();
    const readable = memoryTarget(null);
    markUserEdit('theme');
    expect(dirtySections()).toContain('theme');

    await reconcileTargets([failed.target, readable.target]);

    expect(readable.state.pushes.length).toBe(1); // reached the readable store
    expect(dirtySections()).toContain('theme'); // but stays dirty — a store was unreadable
  });

  it('clears dirty once the edit reaches all stores with none failing', async () => {
    const readable = memoryTarget(null);
    markUserEdit('theme');
    expect(dirtySections()).toContain('theme');

    await reconcileTargets([readable.target]);

    expect(dirtySections()).not.toContain('theme'); // confirmed everywhere → cleared
  });

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

  it('does not adopt (reload) when local and remote differ only in JSON key order', async () => {
    // The production oscillation: the blob held an event as {...event, id}
    // (id last, written by the editor), while every mount re-persisted the
    // sanitizer's {id, kind, anchor, …} shape — same content, same stamp,
    // different bytes. The store's ordering won the byte tie-break, so the
    // startup reconcile adopted and reloaded the Mini App on every open.
    const stamp = '2026-08-05T04:22:48.360Z';
    const event = { kind: 'birth', anchor: { hebrew: { year: 5754, month: 6, day: 1 } }, id: 'e1' };
    const person = (ev: object) => ({ people: [{ id: 'p1', name: 'M', events: [ev] }], occasions: [] });
    window.localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ personalDates: person({ id: 'e1', kind: 'birth', anchor: { hebrew: { year: 5754, month: 6, day: 1 } } }) }),
    );
    stampSection('prefs', stamp);
    const { target, state } = memoryTarget(blob({ prefs: { data: { personalDates: person(event) }, t: stamp } }));

    const result = await reconcileTargets([target]);

    expect(result.outcome).toBe('clean'); // no adopt → no reload, and nothing pushed
    expect(state.pushes).toEqual([]);
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

  describe('Mini App language passivity', () => {
    // Inside Telegram the page locale is the BOT's, not the user's: the bot
    // relaunches the app at its own language path (/he|/ru) on EVERY open. The
    // URL-derived language must therefore neither be adopted over (adopting
    // navigates = restarts the webview, and the next launch resets the locale
    // right back — a restart on every open) nor pushed out as if the user chose
    // it (it would clobber the language picked on the website).
    beforeEach(() => {
      installMemorySessionStorage();
      window.sessionStorage.setItem('zmanim:tg-mini-app', '1');
    });
    afterEach(() => {
      installMemorySessionStorage(); // drop the flag for the tests that follow
    });

    it('never adopts a remote language at an equal stamp (the restart-on-every-open bug)', async () => {
      // Launch at the bot's /he; the blob says 'ru' at the same stamp (a prior
      // adoption copied it). 'ru' wins the fingerprint tie-break, so without
      // the rule this adopts + navigates on every single open.
      const stamp = '2026-08-01T00:00:00.000Z';
      document.documentElement.lang = 'he';
      stampSection('language', stamp);
      const { target, state } = memoryTarget(blob({ language: { data: 'ru', t: stamp } }));

      const result = await reconcileTargets([target]);

      expect(result.outcome).toBe('clean'); // no adopt → no reload
      expect(result.appliedLanguage).toBeNull();
      expect(state.pushes).toEqual([]); // and nothing pushed back either
    });

    it('never adopts a genuinely newer remote language (the session mirrors the bot)', async () => {
      document.documentElement.lang = 'ru';
      stampSection('language', '2026-08-01T00:00:00.000Z');
      const { target, state } = memoryTarget(
        blob({ language: { data: 'en', t: '2026-08-05T00:00:00.000Z' } }),
      );

      const result = await reconcileTargets([target]);

      expect(result.outcome).toBe('clean');
      expect(result.appliedLanguage).toBeNull(); // no navigation — the session stays at the launch locale
      expect(state.blob?.sections.language.data).toBe('en'); // the account's language is untouched
    });

    it('never pushes the launch locale over the account language at an equal stamp', async () => {
      // Launch at /ru; the blob says 'en' at the same stamp. 'ru' would win the
      // tie-break and silently overwrite the language picked on the website.
      const stamp = '2026-08-01T00:00:00.000Z';
      document.documentElement.lang = 'ru';
      stampSection('language', stamp);
      const { target, state } = memoryTarget(blob({ language: { data: 'en', t: stamp } }));

      const result = await reconcileTargets([target]);

      expect(result.outcome).toBe('clean');
      expect(state.pushes).toEqual([]);
      expect(state.blob?.sections.language.data).toBe('en');
    });

    it('still propagates an explicit in-session language pick', async () => {
      // The user opened the language settings inside the Mini App and chose
      // English — a deliberate edit (dirty) beats the passivity rule.
      document.documentElement.lang = 'en';
      markUserEdit('language');
      const { target, state } = memoryTarget(
        blob({ language: { data: 'ru', t: '2026-08-01T00:00:00.000Z' } }),
      );

      const result = await reconcileTargets([target]);

      expect(result.outcome).toBe('pushed');
      expect(state.blob?.sections.language.data).toBe('en');
    });

    it('on the plain site (no Mini App flag) the language still syncs both ways', async () => {
      installMemorySessionStorage(); // no flag — the website
      const stamp = '2026-08-01T00:00:00.000Z';
      document.documentElement.lang = 'he';
      stampSection('language', stamp);
      const { target } = memoryTarget(blob({ language: { data: 'ru', t: stamp } }));

      const result = await reconcileTargets([target]);

      expect(result.outcome).toBe('applied'); // the web behavior is unchanged
      expect(result.appliedLanguage).toBe('ru');
    });
  });

  describe('an app update that changes the prefs written at mount', () => {
    // The reload-on-first-open-after-a-release bug. A release that adds a
    // preference key (or changes a default, e.g. 1.27's Daf-Yomi-only learning
    // list) makes the mount-written prefs differ from the account's copy with
    // nobody having edited anything — at the SAME stamp, because nothing
    // stamped it. The equal-stamp tie-break decides by fingerprint order, and a
    // grown section LOSES it by construction ('}' and ']' sort above ',' and
    // '"'), so the store's pre-update copy was adopted and the page reloaded.
    // Inside the Mini App that reads as the webview restarting right after
    // launch — and it swallowed the "What's new" popup along with it.
    const STAMP = '2026-08-01T00:00:00.000Z';
    const agreedPrefs = { candleLightingOffset: 18, hiddenLearning: [] as string[] };

    /** The device is up to date with the store, then the app updates under it. */
    function seedUpdatedDevice(updated: Record<string, unknown>) {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
      stampSection('prefs', STAMP);
      recordSyncedPrefs(sectionFingerprint('prefs', agreedPrefs));
      return memoryTarget(blob({ prefs: { data: agreedPrefs, t: STAMP } }));
    }

    it('pushes the new defaults instead of adopting the pre-update copy', async () => {
      const { target, state } = seedUpdatedDevice({
        ...agreedPrefs,
        hiddenLearning: ['mishna-yomi', 'nach-yomi'],
        learningCustomized: false,
      });

      const result = await reconcileTargets([target]);

      expect(result.outcome).toBe('pushed'); // NOT 'applied' — no reload
      expect(state.blob?.sections.prefs.data).toMatchObject({ learningCustomized: false });
      // And the local copy is left alone, so the reload would have nothing to show.
      expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toMatchObject({
        hiddenLearning: ['mishna-yomi', 'nach-yomi'],
      });
    });

    it('stamps the pushed prefs above the tie so the update sticks on the next run', async () => {
      const { target, state } = seedUpdatedDevice({ ...agreedPrefs, learningCustomized: false });

      await reconcileTargets([target]);
      expect(Date.parse(state.blob!.sections.prefs.t)).toBeGreaterThan(Date.parse(STAMP));

      const second = await reconcileTargets([target]);
      expect(second.outcome).toBe('clean'); // converged — no second push, no adopt
    });

    it('still adopts a store that genuinely moved since the last agreed sync', async () => {
      // Same equal stamp, but the store no longer holds what we last agreed on:
      // another device edited it. That IS newer information — adopt it.
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ ...agreedPrefs, learningCustomized: false }));
      stampSection('prefs', STAMP);
      recordSyncedPrefs(sectionFingerprint('prefs', agreedPrefs));
      const { target } = memoryTarget(
        blob({ prefs: { data: { candleLightingOffset: 40, hiddenLearning: [] }, t: STAMP } }),
      );

      const result = await reconcileTargets([target]);

      expect(result.outcome).toBe('applied');
      expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toMatchObject({
        candleLightingOffset: 40,
      });
    });

    it('still adopts a newer remote at a higher stamp', async () => {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ ...agreedPrefs, learningCustomized: false }));
      stampSection('prefs', STAMP);
      recordSyncedPrefs(sectionFingerprint('prefs', agreedPrefs));
      const { target } = memoryTarget(
        blob({ prefs: { data: agreedPrefs, t: '2026-08-02T00:00:00.000Z' } }),
      );

      const result = await reconcileTargets([target]);

      expect(result.outcome).toBe('applied');
    });

    it('does nothing on a device that never agreed with the store', async () => {
      // No recorded agreement (lastSyncedPrefs) — nothing to compare against,
      // so the ordinary merge rules decide, unchanged.
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ ...agreedPrefs, learningCustomized: false }));
      stampSection('prefs', STAMP);
      const { target } = memoryTarget(blob({ prefs: { data: agreedPrefs, t: STAMP } }));

      const result = await reconcileTargets([target]);

      expect(result.outcome).toBe('applied');
    });
  });

  it('records a forensic breadcrumb naming the winning store and the first differing bytes', async () => {
    document.documentElement.lang = '';
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    stampSection('theme', '2026-08-01T00:00:00.000Z');
    const { target } = memoryTarget(blob({ theme: { data: 'dark', t: '2026-08-02T00:00:00.000Z' } }));

    await reconcileTargets([target]);

    const crumb = JSON.parse(window.localStorage.getItem('zmanim:sync-last-adopt:v1')!) as {
      adopt: string[];
      detail: Record<string, { source: string; localT: string; winnerT: string; diffAt: number; local: string; winner: string }>;
    };
    expect(crumb.adopt).toEqual(['theme']);
    expect(crumb.detail.theme.source).toBe('telegram-bot');
    expect(crumb.detail.theme.localT).toBe('2026-08-01T00:00:00.000Z');
    expect(crumb.detail.theme.winnerT).toBe('2026-08-02T00:00:00.000Z');
    // The excerpts show the actual divergence, so the field is nameable after the fact.
    expect(crumb.detail.theme.local).toContain('light');
    expect(crumb.detail.theme.winner).toContain('dark');
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

describe('connect-time account protection (lineage)', () => {
  /** What the just-connected account already holds. */
  const accountBlob = () =>
    blob({ prefs: { data: { candleLightingOffset: 40 }, t: '2026-07-20T10:00:00.000Z' } });

  /** This device: data left over from a previous session, stamped NEWER than the account's. */
  function seedLocalLeftovers() {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 18 }));
    stampSection('prefs', '2026-07-21T10:00:00.000Z');
  }

  it('never lets local leftovers overwrite a freshly connected account (the reported bug)', async () => {
    // Telegram session data on the device, then sign in to Google: the local
    // stamps are newer, but they belong to another account's history — the
    // account's stored settings must survive until the user chooses.
    seedLocalLeftovers();
    const { target, state } = memoryTarget(accountBlob(), 'account-b');

    const result = await reconcileTargets([target]);

    expect(result.outcome).toBe('conflict');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].remote.sections.prefs.data).toEqual({ candleLightingOffset: 40 });
    expect(state.pushes).toEqual([]); // the account's data was NOT overwritten
    // ...and nothing was adopted either — the device keeps its own until the choice.
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 18 });

    // Unresolved = asked again on the next run; the store stays quarantined.
    const again = await reconcileTargets([target]);
    expect(again.outcome).toBe('conflict');
    expect(state.pushes).toEqual([]);
  });

  it('seeds an empty account store silently and records lineage', async () => {
    seedLocalLeftovers();
    const { target, state } = memoryTarget(null, 'account-b');

    const first = await reconcileTargets([target]);
    expect(first.outcome).toBe('pushed');
    expect(state.blob?.sections.prefs.data).toEqual({ candleLightingOffset: 18 });

    // Lineage recorded: a later, newer remote is a normal merge — adopted, not a conflict.
    state.blob = blob({ prefs: { data: { candleLightingOffset: 25 }, t: '2026-07-22T10:00:00.000Z' } });
    const second = await reconcileTargets([target]);
    expect(second.outcome).toBe('applied');
  });

  it('adopts the account silently when this device has no settings history', async () => {
    // A fresh device (nothing ever stamped) has nothing to lose — no dialog.
    const { target } = memoryTarget(accountBlob(), 'account-b');

    const result = await reconcileTargets([target]);
    expect(result.outcome).toBe('applied');
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 40 });
  });

  it('lets the account win a section this device holds only by default (never stamped)', async () => {
    // Device: deliberate theme + the URL-derived default language, never
    // stamped. Account: a different language. Not a conflict — the visitor
    // never chose 'en', so the account's 'he' simply wins.
    document.documentElement.lang = 'en';
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    stampSection('theme', '2026-07-21T10:00:00.000Z');
    const { target } = memoryTarget(
      blob({ language: { data: 'he', t: '2026-07-20T10:00:00.000Z' } }),
      'account-b',
    );

    const result = await reconcileTargets([target]);
    expect(result.outcome).toBe('applied');
    expect(result.appliedLanguage).toBe('he');
  });

  it('never overwrites a freshly connected account with a pristine device on an equal stamp', async () => {
    // The reported data loss. Both sides sit at the EPOCH: the account's blob
    // was pushed by a device that never re-stamped prefs (the common case —
    // prefs is stamped only when the change watcher sees a real edit), and this
    // device never stamped anything either.
    //
    // The gate waves this through: the local section is unstamped and holds
    // nothing but mount-written defaults, so there is "nothing to lose" and no
    // dialog is raised. The merge must then hand the section to the ACCOUNT.
    // It used to fall through to the equal-stamp fingerprint tie-break, which
    // is content order — arbitrary — and when the device's defaults sorted
    // higher they were pushed straight over the account's real settings
    // (personal dates and all), silently.
    const pristine = { location: { lat: 31.778, lng: 35.2354, timeZoneId: 'Asia/Jerusalem', inIsrael: true } };
    const real = {
      location: { lat: 29.5581, lng: 34.9482, timeZoneId: 'Asia/Jerusalem', inIsrael: true },
      personalDates: { people: [{ id: 'p1', name: 'Yahrzeit' }], occasions: [] },
    };
    // Pin the premise: the device's defaults really do sort above the account's
    // data, so the tie-break would pick the device.
    expect(JSON.stringify(pristine) > JSON.stringify(real)).toBe(true);

    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(pristine));
    const { target, state } = memoryTarget(blob({ prefs: { data: real, t: EPOCH } }), 'account-b');

    const result = await reconcileTargets([target]);

    expect(state.pushes).toEqual([]); // the account's settings were NOT overwritten
    expect(result.outcome).toBe('applied'); // the device took the account's copy instead
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual(real);
  });

  it('an equal stamp never costs personal dates — the richer side wins, not the higher-sorting one', async () => {
    // Same account (lineage recorded), both sides stamped at the same moment
    // with no history to order them. A deletion always bumps the stamp, so a
    // side that is poorer at an EQUAL stamp never deleted anything — it simply
    // never had the data, and must not win a fingerprint coin flip.
    const t = '2026-07-21T10:00:00.000Z';
    const withDates = {
      location: { lat: 32.08, lng: 34.78 },
      personalDates: { people: [{ id: 'p1', name: 'Yahrzeit' }], occasions: [{ id: 'o1' }] },
    };
    const empty = { location: { lat: 41.0, lng: 34.78 }, personalDates: { people: [], occasions: [] } };
    expect(JSON.stringify(empty) > JSON.stringify(withDates)).toBe(true); // the device would win on order

    recordLineage('telegram-bot', 'account-b');
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(empty));
    stampSection('prefs', t);
    const { target, state } = memoryTarget(blob({ prefs: { data: withDates, t } }), 'account-b');

    const result = await reconcileTargets([target]);

    expect(state.pushes).toEqual([]);
    expect(result.outcome).toBe('applied');
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual(withDates);
  });

  it('asks before a push drops a personal date the account holds, then obeys the answer', async () => {
    // A newer local prefs wins its section WHOLE, so it carries away any item
    // the account has that this device never saw. That is unrecoverable, so the
    // push is withheld and the user is asked — even though the store is settled
    // and this device is genuinely newer.
    const withDates = { personalDates: { people: [{ id: 'p1', name: 'Yahrzeit' }], occasions: [] } };
    const without = { personalDates: { people: [], occasions: [] } };

    recordLineage('telegram-bot', 'account-b');
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(without));
    stampSection('prefs', '2026-07-22T10:00:00.000Z');
    const { target, state } = memoryTarget(
      blob({ prefs: { data: withDates, t: '2026-07-21T10:00:00.000Z' } }),
      'account-b',
    );

    const first = await reconcileTargets([target]);

    expect(first.outcome).toBe('conflict');
    expect(first.conflicts[0].reason).toBe('removes-data');
    expect(state.pushes).toEqual([]); // the account keeps its personal date for now
    expect(state.blob?.sections.prefs.data).toEqual(withDates);

    // "Keep this device's settings" — the deletion WAS deliberate. The answer
    // marks the sections as user edits, which exempts them from the guard, so
    // the deletion now propagates instead of being asked about forever.
    keepDeviceSettings(first.conflicts);
    const second = await reconcileTargets([target]);

    expect(second.outcome).toBe('pushed');
    expect(state.blob?.sections.prefs.data).toEqual(without);
  });

  it('does not conflict when the account holds only sections this device never set', async () => {
    // Device: only a theme. Account: only prefs. Nothing overlaps — the merge
    // fills both sides losslessly (present beats absent).
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    stampSection('theme', '2026-07-21T10:00:00.000Z');
    const { target, state } = memoryTarget(accountBlob(), 'account-b');

    const result = await reconcileTargets([target]);
    expect(result.outcome).toBe('applied'); // the account's prefs were adopted…
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 40 });
    expect(state.blob?.sections.theme.data).toBe('dark'); // …and the device's theme seeded the account
  });

  it('reconnecting the agreeing account records lineage and syncs edits normally after', async () => {
    // Connect with identical content: silent. Then an edit pushes without re-asking.
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 40 }));
    stampSection('prefs', '2026-07-20T10:00:00.000Z');
    const { target, state } = memoryTarget(accountBlob(), 'account-b');
    expect((await reconcileTargets([target])).outcome).toBe('clean');

    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 18 }));
    markUserEdit('prefs');
    const second = await reconcileTargets([target]);
    expect(second.outcome).toBe('pushed');
    expect(state.blob?.sections.prefs.data).toEqual({ candleLightingOffset: 18 });
  });

  it('adoptAccountSettings applies the account side and un-quarantines the store', async () => {
    seedLocalLeftovers();
    const { target, state } = memoryTarget(accountBlob(), 'account-b');
    const first = await reconcileTargets([target]);
    expect(first.outcome).toBe('conflict');

    const { ok, language } = await adoptAccountSettings(first.conflicts, [target]);
    expect(ok).toBe(true);
    expect(language).toBeNull(); // the account stored no language section
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 40 });

    // The post-reload reconcile agrees — no bounce-back of the old local data.
    const second = await reconcileTargets([target]);
    expect(second.outcome).toBe('clean');
    expect(state.pushes).toEqual([]);
  });

  it('keepDeviceSettings makes the device win explicitly on the next run', async () => {
    seedLocalLeftovers();
    const { target, state } = memoryTarget(accountBlob(), 'account-b');
    const first = await reconcileTargets([target]);
    expect(first.outcome).toBe('conflict');

    keepDeviceSettings(first.conflicts);
    const second = await reconcileTargets([target]);
    expect(second.outcome).toBe('pushed');
    expect(state.blob?.sections.prefs.data).toEqual({ candleLightingOffset: 18 });
  });

  it('protects legacy prefs that predate sync stamps (content, not history, decides)', async () => {
    // A device last used before v1.22: real custom dates in prefs, but no
    // section stamp anywhere. Connecting an account with different data must
    // still ask — silent adoption would delete the dates.
    window.localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ personalDates: { people: [{ id: 'p1', name: 'Someone' }], occasions: [] } }),
    );
    const { target, state } = memoryTarget(accountBlob(), 'account-b');

    const result = await reconcileTargets([target]);
    expect(result.outcome).toBe('conflict');
    expect(state.pushes).toEqual([]);
  });

  it('protects an unstamped legacy theme — a stored theme is always an explicit pick', async () => {
    // The theme key long predates sync stamps and is only ever written by the
    // user choosing one; a pre-v1.22 'dark' must not be silently reverted.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { target, state } = memoryTarget(
      blob({ theme: { data: 'light', t: '2026-07-20T10:00:00.000Z' } }),
      'account-b',
    );

    const result = await reconcileTargets([target]);
    expect(result.outcome).toBe('conflict');
    expect(state.pushes).toEqual([]);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('protects unstamped non-default a11y settings, but mount-written defaults adopt silently', async () => {
    // The accessibility provider writes its defaults on every mount, so only
    // a NON-default value counts as something to lose.
    window.localStorage.setItem(
      A11Y_STORAGE_KEY,
      JSON.stringify({ fontScale: 'xl', reduceMotion: false, highContrast: false }),
    );
    const remoteA11y = { fontScale: 'default', reduceMotion: false, highContrast: true };
    const first = memoryTarget(blob({ a11y: { data: remoteA11y, t: '2026-07-20T10:00:00.000Z' } }), 'account-b');
    expect((await reconcileTargets([first.target])).outcome).toBe('conflict');
    expect(first.state.pushes).toEqual([]);

    // Same connect with pristine local defaults: nothing to lose — silent adopt.
    window.localStorage.setItem(
      A11Y_STORAGE_KEY,
      JSON.stringify({ fontScale: 'default', reduceMotion: false, highContrast: false }),
    );
    const second = memoryTarget(blob({ a11y: { data: remoteA11y, t: '2026-07-20T10:00:00.000Z' } }), 'account-c');
    expect((await reconcileTargets([second.target])).outcome).toBe('applied');
    expect(JSON.parse(window.localStorage.getItem(A11Y_STORAGE_KEY)!)).toEqual(remoteA11y);
  });

  it('still adopts silently when unstamped prefs are just mount-written defaults', async () => {
    // Every fresh device writes default prefs on mount; that's not user data.
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 18 }));
    const { target } = memoryTarget(accountBlob(), 'account-b');

    const result = await reconcileTargets([target]);
    expect(result.outcome).toBe('applied');
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 40 });
  });

  it('resolves conflicts one account at a time — the second account stays quarantined', async () => {
    // Telegram and Google both freshly connected, both clashing with the
    // device. Their stamps are mutually incomparable, so one choice must not
    // resolve (or un-quarantine) both.
    seedLocalLeftovers();
    const telegram = memoryTarget(accountBlob(), 'tg-account', 'telegram-bot');
    const google = memoryTarget(
      blob({ prefs: { data: { candleLightingOffset: 60 }, t: '2026-07-19T10:00:00.000Z' } }),
      'google-account',
      'google-websync',
    );

    const first = await reconcileTargets([telegram.target, google.target]);
    expect(first.outcome).toBe('conflict');
    expect(first.conflicts).toHaveLength(2);

    // Resolve the first (Telegram) group toward the device.
    keepDeviceSettings(first.conflicts);
    const second = await reconcileTargets([telegram.target, google.target]);
    expect(telegram.state.blob?.sections.prefs.data).toEqual({ candleLightingOffset: 18 }); // resolved & pushed
    expect(google.state.pushes).toEqual([]); // still quarantined —
    expect(second.outcome).toBe('conflict'); // — and asked about separately
    expect(second.conflicts).toHaveLength(1);
    expect(second.conflicts[0].account).toBe('google-account');
  });

  it('adoptAccountSettings prefers a fresh pull over the stale dialog snapshot', async () => {
    // While the dialog sat open, another device pushed newer data to the
    // account. "Use account settings" must adopt what the account holds NOW,
    // not the snapshot behind the dialog — restamping the stale copy as a
    // fresh edit would overwrite the other device's update everywhere.
    seedLocalLeftovers();
    const { target, state } = memoryTarget(accountBlob(), 'account-b');
    const first = await reconcileTargets([target]);
    expect(first.outcome).toBe('conflict');

    state.blob = blob({ prefs: { data: { candleLightingOffset: 33 }, t: '2026-07-22T10:00:00.000Z' } });
    await adoptAccountSettings(first.conflicts, [target]);
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 33 });
  });

  it('aborts "use account" when the account cannot be re-read — never adopts a stale snapshot', async () => {
    // The re-pull failing means the account's CURRENT contents are unknown;
    // adopting the dialog snapshot could overwrite a newer update from
    // another device. Nothing may change, and the store stays quarantined.
    seedLocalLeftovers();
    const { target } = memoryTarget(accountBlob(), 'account-b');
    const first = await reconcileTargets([target]);
    expect(first.outcome).toBe('conflict');

    const failing: SyncTarget = { ...target, pull: async () => PULL_FAILED };
    const result = await adoptAccountSettings(first.conflicts, [failing]);
    expect(result.ok).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 18 });
    expect(lineageAccount(target.id)).toBeNull(); // still quarantined — retry later
  });

  it('adopts nothing when the account was emptied while the dialog sat open', async () => {
    // A pull that reads EMPTY is definitive (the data was deleted meanwhile):
    // don't resurrect the snapshot — keep the device's settings, record the
    // lineage, and let the next run seed the store.
    seedLocalLeftovers();
    const { target, state } = memoryTarget(accountBlob(), 'account-b');
    const first = await reconcileTargets([target]);
    expect(first.outcome).toBe('conflict');

    state.blob = null; // deleted from another device
    const result = await adoptAccountSettings(first.conflicts, [target]);
    expect(result).toEqual({ ok: true, language: null });
    expect(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY)!)).toEqual({ candleLightingOffset: 18 });
    expect(lineageAccount(target.id)).toBe('account-b'); // resolved — the next push may seed it
  });

  it('records lineage only after the connect run settles', async () => {
    // Lossless connect (device: theme; account: prefs). While the merged push
    // is still in flight, the lineage must not be recorded yet: recording is
    // what un-quarantines the store, and doing it mid-run would let a
    // concurrent run treat the store as settled before this merge landed.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    stampSection('theme', '2026-07-21T10:00:00.000Z');
    let releasePush!: () => void;
    const gate = new Promise<void>((resolve) => {
      releasePush = resolve;
    });
    const state = { blob: accountBlob() as SettingsBlob | null };
    const target: SyncTarget = {
      id: 'telegram-bot',
      account: 'account-b',
      pull: async () => state.blob,
      push: async (b) => {
        await gate;
        state.blob = b;
        return true;
      },
    };

    const run = reconcileTargets([target]);
    await new Promise((resolve) => setTimeout(resolve, 0)); // pull done; push parked on the gate
    expect(lineageAccount(target.id)).toBeNull(); // mid-run: still quarantined

    releasePush();
    await run;
    expect(lineageAccount(target.id)).toBe('account-b'); // settled: lineage recorded
  });
});

describe('consumeStartupReload (startup-reconcile reload guard)', () => {
  beforeEach(() => {
    installMemorySessionStorage();
  });

  it('allows the first startup reload but not a second in the same session', () => {
    // First mount: a newer remote was adopted, so the reconcile reloads once.
    expect(consumeStartupReload()).toBe(true);
    // If anything re-writes prefs at mount, the reconcile wants to adopt+reload
    // again — that is the loop, and the guard blocks it. (The Mini App's
    // location re-apply used to be exactly that; it now only seeds.)
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
