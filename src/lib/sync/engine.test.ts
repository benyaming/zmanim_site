import { beforeEach, describe, expect, it } from 'vitest';

import { PREFS_STORAGE_KEY } from '@/components/providers/app-state';
import { A11Y_STORAGE_KEY } from '@/components/providers/accessibility-provider';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { installMemoryLocalStorage, installMemorySessionStorage } from '@/test/memory-storage';

import {
  dirtySections,
  markUserEdit,
  PULL_FAILED,
  recordLineage,
  SECTION_NAMES,
  stampSection,
  type SettingsBlob,
} from './blob';
import {
  adoptAccountSettings,
  canPushBlind,
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
    expect(canPushBlind(target)).toBe(false); // still quarantined — retry later
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
    expect(canPushBlind(target)).toBe(true); // resolved — the next push may seed it
  });

  it('records lineage only after the connect run settles — blind pushes stay blocked mid-run', async () => {
    // Lossless connect (device: theme; account: prefs). While the merged push
    // is still in flight, the lineage must not be recorded yet: it is what
    // un-gates canPushBlind, and a change-watcher push slipping through
    // mid-run would land its pre-merge snapshot over the store.
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
    expect(canPushBlind(target)).toBe(false); // mid-run: still quarantined

    releasePush();
    await run;
    expect(canPushBlind(target)).toBe(true); // settled: lineage recorded
  });

  it('canPushBlind blocks blind pushes until the lineage is recorded', () => {
    const { target } = memoryTarget(accountBlob(), 'account-b');
    expect(canPushBlind(target)).toBe(false); // fresh connect — must reconcile first

    recordLineage(target.id, 'account-b');
    expect(canPushBlind(target)).toBe(true);

    const { target: anonymous } = memoryTarget(null, null);
    expect(canPushBlind(anonymous)).toBe(true); // no identity — legacy behavior
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
