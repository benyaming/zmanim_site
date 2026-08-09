/**
 * Sync orchestration: one settings blob, several interchangeable stores
 * ("targets"), merged section-by-section (newest wins per section).
 *
 * Targets, all optional and independent (see docs/settings-sync.md):
 *  - Telegram CloudStorage — inside the Mini App, Bot API 6.9+.
 *  - The bot's Mongo (web_prefs) — inside the Mini App via initData, on the
 *    plain site via a stored Login Widget sign-in. This is the authoritative
 *    store for Telegram users: every configurable thing lands there.
 *  - The bot's Mongo (web_sync) — via Sign in with Google, for users without
 *    Telegram.
 *
 * At most ONE account ever syncs (activeSyncTargets): the two Mini App stores
 * share a single Telegram account, and on the website a connected Telegram
 * account sidelines a signed-in Google one. Two accounts would mirror settings
 * into both and bridge data between devices that use only one of them.
 *
 * A run pulls every target, merges each blob's sections with the local ones
 * taking the newest of each, adopts the sections the merge changed (the caller
 * reloads — providers read localStorage at mount), and pushes the merged blob
 * to any target that differs.
 *
 * The one moment "newest wins" is the wrong rule is a fresh CONNECT: stamps
 * only order edits within one account's history, so when a store's account
 * differs from the lineage this device last reconciled with (sign-in after
 * using another account, or ever), the merge would let unrelated local data
 * overwrite the account's stored settings. Such a store is quarantined —
 * neither merged from nor pushed to — and when both sides hold real,
 * conflicting data the run reports a conflict for the UI to resolve
 * (adoptAccountSettings / keepDeviceSettings); an empty or agreeing store
 * re-establishes lineage silently.
 */

import { googleAccountDisplayName, loadGoogleAccount } from '@/lib/google/web-login';
import { botSyncEnabled, fetchBotProfile, pushBotSync, type BotAuth } from '@/lib/telegram/bot-sync';
import { initTelegramMiniApp, isTelegramMiniApp, telegramInitData, telegramUserId } from '@/lib/telegram/mini-app';
import { loadTelegramWebAuth, webAuthDisplayName } from '@/lib/telegram/web-login';

import {
  a11yHoldsUserData,
  applyBlobSections,
  blobStamps,
  changedSections,
  clearDirty,
  clearLineage,
  collectSettingsBlob,
  deserializeSettingsBlob,
  dirtySections,
  lineageAccount,
  markUserEdit,
  mergeBlobs,
  observeStamps,
  prefsHoldUserData,
  recordLineage,
  recordSyncedPrefs,
  removedUserItems,
  restampDirtySections,
  sectionFingerprint,
  SECTION_NAMES,
  serializeSettingsBlob,
  syncDebug,
  PULL_FAILED,
  type PullResult,
  type SectionName,
  type SettingsBlob,
} from './blob';
import { pullFromGoogleWebSync, pushToGoogleWebSync } from './google-websync';
import { cloudStorageAvailable, pullFromTelegramCloud, pushToTelegramCloud } from './telegram-cloud';

export interface SyncTarget {
  id: 'telegram-cloud' | 'telegram-bot' | 'google-websync';
  /**
   * Stable identity of the account behind this store (Telegram user id /
   * Google sync key) — what the lineage record tracks. `null` when unknown;
   * such a store skips the connect-time protection (legacy behavior).
   */
  account: string | null;
  /** Display name for the connect-conflict dialog ("@user", an email); optional. */
  label?: string | null;
  /** SettingsBlob, `null` (empty), or `PULL_FAILED` (couldn't read — don't push over it). */
  pull: () => Promise<PullResult>;
  push: (blob: SettingsBlob) => Promise<boolean>;
}

/** Whole-blob content identity — the concatenation of its section fingerprints. */
function blobFingerprint(blob: SettingsBlob): string {
  return SECTION_NAMES.map((name) => sectionFingerprint(name, blob.sections[name].data)).join('\u0000');
}

function languageOf(blob: SettingsBlob): string | null {
  const data = blob.sections.language.data;
  return typeof data === 'string' ? data : null;
}

function botTarget(auth: BotAuth, account: string | null, label?: string | null): SyncTarget {
  return {
    id: 'telegram-bot',
    account,
    label,
    pull: async () => {
      const profile = await fetchBotProfile(auth);
      if (profile === null) return PULL_FAILED; // couldn't reach the bot — don't overwrite it
      return profile.webPrefs ? deserializeSettingsBlob(profile.webPrefs) : null;
    },
    push: async (blob) => {
      const raw = serializeSettingsBlob(blob);
      if (raw === null) return false;
      return (await pushBotSync(auth, { webPrefs: raw })) !== null;
    },
  };
}

/** The stores reachable right now. */
export async function activeSyncTargets(): Promise<SyncTarget[]> {
  const targets: SyncTarget[] = [];
  if (isTelegramMiniApp()) {
    const webApp = await initTelegramMiniApp();
    const initData = telegramInitData() ?? (webApp?.initData || null);
    // The account behind BOTH Mini App stores — Telegram multi-account shares
    // one webview localStorage, so the owner can change between launches.
    const account = initData ? telegramUserId(initData) : null;
    if (cloudStorageAvailable(webApp)) {
      targets.push({
        id: 'telegram-cloud',
        account,
        pull: () => pullFromTelegramCloud(webApp),
        push: (blob) => pushToTelegramCloud(webApp, blob),
      });
    }
    if (botSyncEnabled() && initData) targets.push(botTarget(initData, account));
  } else {
    // Null when bot sync is unconfigured: an auth we can't sync with isn't a
    // connected account, and must not sideline Google below.
    const telegramAuth = botSyncEnabled() ? loadTelegramWebAuth() : null;
    if (telegramAuth) {
      targets.push(
        botTarget({ authData: { ...telegramAuth } }, String(telegramAuth.id), webAuthDisplayName(telegramAuth)),
      );
    }
    // Google belongs to the plain website only. Inside the Mini App the bot is
    // already the store (via initData), so there is nothing for it to add.
    const googleAccount = loadGoogleAccount();
    if (googleAccount) {
      // EXACTLY ONE account syncs per device, and this is where that holds —
      // not the account panel, which only decides what's offered. Two live
      // stores would mirror every setting into two unrelated accounts and make
      // this device a bridge copying data between a Telegram-only device and a
      // Google-only one. Telegram wins: it is the authoritative store for its
      // users (it also carries the structured location / candle offset /
      // havdalah opinion the bot itself models), and it is the only account
      // inside the Mini App. Google stays signed in but dormant — dropping the
      // credential would delete a connection the user never asked to end.
      if (telegramAuth) {
        // A dormant store misses every push, so its stamps go stale while the
        // other account moves on. Forget its lineage: whenever it becomes
        // active again (Telegram disconnected), it must reconcile as a fresh
        // connect instead of blind-pushing this device's state over settings
        // another device may have written meanwhile.
        clearLineage('google-websync');
      } else {
        targets.push({
          id: 'google-websync',
          account: googleAccount.key,
          label: googleAccountDisplayName(googleAccount) || null,
          pull: () => pullFromGoogleWebSync(googleAccount),
          push: (blob) => pushToGoogleWebSync(googleAccount, blob),
        });
      }
    }
  }
  return targets;
}

export type SyncOutcome =
  /** A newer remote section was written locally — the caller must reload. */
  | 'applied'
  /** Local settings were sent to at least one differing store. */
  | 'pushed'
  /** Everything already agreed. */
  | 'clean'
  /** No store is connected/reachable. */
  | 'none'
  /** A freshly connected account's data clashes with this device's — the user must choose. */
  | 'conflict';

/**
 * A store whose account this device never reconciled with, holding real data
 * that disagrees with real local data. Resolved by the user's explicit choice:
 * adoptAccountSettings or keepDeviceSettings.
 */
export interface SyncConflict {
  targetId: SyncTarget['id'];
  account: string;
  label: string | null;
  remote: SettingsBlob;
  /**
   * Why the store is quarantined, which is what the dialog explains:
   * 'connect' — a newly connected account whose data clashes with this device's.
   * 'removes-data' — pushing would drop personal dates or saved locations the
   * store holds (see the destructive-push guard in reconcileTargets).
   */
  reason: 'connect' | 'removes-data';
}

/** Fired (with `detail: SyncConflict[]`) when a run finds connect conflicts. */
export const SYNC_CONFLICT_EVENT = 'zmanim:sync-conflict';

export interface SyncResult {
  outcome: SyncOutcome;
  /**
   * On 'applied', the merged language ('en'|'he'|'ru'|null) when the language
   * section was among those adopted, else null. The caller applies it by
   * navigating to that locale (see reloadForSync); other sections just reload.
   */
  appliedLanguage: string | null;
  /** Connect conflicts awaiting the user's choice; empty when there are none. */
  conflicts: SyncConflict[];
}

export interface SyncOptions {
  /** Allow adopting newer remote sections (the caller commits to reloading). */
  allowApply?: boolean;
}

export async function runSync(options: SyncOptions = {}): Promise<SyncResult> {
  const targets = await activeSyncTargets();
  if (targets.length === 0) return { outcome: 'none', appliedLanguage: null, conflicts: [] };
  const result = await reconcileTargets(targets, options);
  // Announce conflicts app-wide: whoever triggered the run (startup mount,
  // sign-in event, the panel's Sync now), the settings-sync provider owns the
  // resolution dialog.
  if (result.conflicts.length > 0) {
    try {
      window.dispatchEvent(new CustomEvent(SYNC_CONFLICT_EVENT, { detail: result.conflicts }));
    } catch {
      // No DOM (tests/SSR) — callers still see the conflicts in the result.
    }
  }
  return result;
}

/**
 * The connect gate: sections where BOTH sides hold real data that disagrees.
 * A section only one side has is not a conflict — the merge resolves it
 * losslessly (present beats absent), filling the store or the device. Nor is
 * a local section still at the EPOCH — unless `realUnstamped` vouches for it:
 * pre-v1.22 devices carry deliberate choices with no stamp at all, so content
 * decides what counts (the URL-derived default language and mount-written
 * defaults never do, keeping fresh devices silent).
 */
function conflictingSections(
  local: SettingsBlob,
  remote: SettingsBlob,
  realUnstamped: Record<SectionName, boolean>,
): boolean {
  return SECTION_NAMES.some((name) => {
    const l = local.sections[name];
    const r = remote.sections[name];
    if (l.data === null || r.data === null) return false;
    if (nothingToLose(local, name, realUnstamped)) return false;
    return sectionFingerprint(name, l.data) !== sectionFingerprint(name, r.data);
  });
}

/**
 * A local section the connect gate may replace without asking: never stamped on
 * this device, and its content doesn't vouch for it either (mount-written
 * defaults, the URL-derived language). "May replace" is only sound if the
 * account's copy then actually WINS the merge — see the yield below.
 */
function nothingToLose(local: SettingsBlob, name: SectionName, realUnstamped: Record<SectionName, boolean>): boolean {
  return Date.parse(local.sections[name].t) <= 0 && !realUnstamped[name];
}

/**
 * The pull-merge-push reconcile over a concrete target set — the pure core of
 * runSync, separated so it can be tested without the store plumbing.
 */
export async function reconcileTargets(
  targets: SyncTarget[],
  { allowApply = true }: SyncOptions = {},
): Promise<SyncResult> {
  // Snapshot the local settings BEFORE pulling. The pull is a network round
  // trip; during it, mount-time auto-adjustments (location auto-detect,
  // elevation backfill, relabel) can still be mutating localStorage. Reading
  // after the pull would let that noise leak into the merge.
  const local = collectSettingsBlob();

  // Inside the Mini App the page locale is the BOT's, not the user's: Telegram
  // relaunches the app at the bot-language path (/he|/ru) on every open, so the
  // URL-derived language section re-diverges from the blob at every launch
  // whenever the two differ. Adopting the blob's language would navigate — a
  // visible webview restart — on every single open (the next launch resets the
  // locale right back), and winning the equal-stamp tie-break instead would
  // silently overwrite the language picked on the website. So the Mini App is
  // PASSIVE about language, mirroring the deep-link location rule (app-state):
  // the local side contributes nothing — the blob's language rides through the
  // merge by presence and is pushed onward intact — and a remote language is
  // never adopted; the session simply runs at the launch locale, like the bot.
  // The one exception is an explicit in-session pick (dirty): a deliberate
  // edit still wins the merge and propagates.
  const passiveLanguage = isTelegramMiniApp() && !dirtySections().includes('language');
  if (passiveLanguage) local.sections.language = { ...local.sections.language, data: null };

  // The explicit element type keeps PULL_FAILED's `unique symbol` identity,
  // which `await` inference widens to plain `symbol` (breaking `!==` narrowing).
  const results: { target: SyncTarget; blob: PullResult }[] = await Promise.all(
    targets.map(async (target) => ({ target, blob: await target.pull() })),
  );

  // Advance the Lamport clock past every stamp seen — conflicted stores too:
  // observing just guarantees future local stamps land above them.
  const pulled = results.map((r) => r.blob).filter((b): b is SettingsBlob => b !== null && b !== PULL_FAILED);
  observeStamps([local, ...pulled].flatMap(blobStamps));

  // The connect gate. A store whose account doesn't match the lineage record
  // was never reconciled with this device's data: its stamps and the local
  // ones come from unrelated histories, so "newest wins" would be arbitrary —
  // signing in must never let another account's local leftovers overwrite the
  // account's stored settings. When both sides hold clashing real data the
  // store is quarantined (not merged from, not pushed to) and reported as a
  // conflict for the user to resolve; otherwise the reconcile is lossless
  // (empty store seeds, absent sections fill), so the lineage is recorded and
  // the store takes part normally.
  // Unstamped sections still count as real when their CONTENT shows deliberate
  // use — devices from before sync metadata existed carry choices with no
  // stamp at all. Theme is persisted only by an explicit pick, so presence
  // alone is deliberate; a11y is judged against its mount-written defaults;
  // prefs by its user-data fields — but on the web only, because the Mini App
  // seeds the bot's structured location into prefs on a device that has none,
  // which would read as "user data" and raise a bogus first-run conflict
  // against the bot's own blob. Language is URL-derived and never counts.
  const realUnstamped: Record<SectionName, boolean> = {
    prefs: !isTelegramMiniApp() && prefsHoldUserData(local.sections.prefs.data),
    a11y: a11yHoldsUserData(local.sections.a11y.data),
    theme: local.sections.theme.data !== null,
    language: false,
  };
  const conflicts: SyncConflict[] = [];
  const settled: typeof results = [];
  // Lineage recording is DEFERRED until this run settles: the record is what
  // un-quarantines the store, so writing it here — while the merged push and
  // adoption are still ahead — would let a concurrently firing run treat the
  // store as settled and slip its own pre-merge snapshot over it, erasing
  // remote sections this merge was about to keep.
  const pendingLineage: { targetId: string; account: string }[] = [];
  // The blobs of the freshly connected stores the gate waved through — the ones
  // whose reconcile it just promised is lossless.
  const freshlyConnected: SettingsBlob[] = [];
  for (const { target, blob } of results) {
    if (target.account !== null && blob !== PULL_FAILED && lineageAccount(target.id) !== target.account) {
      // No extra "has anything ever stamped" guard: a conflicting section
      // already requires a real (stamped or content-vouched) local value.
      if (blob !== null && conflictingSections(local, blob, realUnstamped)) {
        conflicts.push({
          targetId: target.id,
          account: target.account,
          label: target.label ?? null,
          remote: blob,
          reason: 'connect',
        });
        continue;
      }
      pendingLineage.push({ targetId: target.id, account: target.account });
      if (blob !== null) freshlyConnected.push(blob);
    }
    settled.push({ target, blob });
  }
  const commitLineage = () => {
    for (const { targetId, account } of pendingLineage) recordLineage(targetId, account);
  };

  // Make the gate's promise true. Waving a connect through means "this is
  // lossless: the account keeps what it holds, the device keeps what only it
  // has" — but a section the gate judged as having nothing to lose could still
  // WIN the merge against the account's copy. Both sides commonly sit at the
  // EPOCH (prefs is stamped only when the user really edits it, so a device
  // that just signed in and pushed stores it unstamped), and the equal-stamp
  // tie-break then decides by fingerprint order — arbitrarily. Whenever it
  // picked the device, its mount-written defaults were pushed over the
  // account's real settings — personal dates and all — with no dialog: exactly
  // the silent loss the gate exists to prevent, and unrecoverable.
  //
  // So yield those sections: dropping them from the local side of the merge
  // makes the account's copy win by presence (absent never beats present) at
  // any stamp, and it is adopted here instead of overwriting the account. Only
  // sections the gate already declared free to replace are yielded, so a
  // device with real data still raises a conflict and is never silently reset.
  for (const name of SECTION_NAMES) {
    if (local.sections[name].data === null || !nothingToLose(local, name, realUnstamped)) continue;
    const localFingerprint = sectionFingerprint(name, local.sections[name].data);
    const accountDiffers = freshlyConnected.some(
      (remote) =>
        remote.sections[name].data !== null &&
        sectionFingerprint(name, remote.sections[name].data) !== localFingerprint,
    );
    if (accountDiffers) local.sections[name] = { ...local.sections[name], data: null };
  }
  const remotes = settled.map((r) => r.blob).filter((b): b is SettingsBlob => b !== null && b !== PULL_FAILED);

  // Now that we've seen the newest remote stamps, re-stamp the sections the
  // user edited locally (dirty) ABOVE them, so an explicit edit wins even if
  // this device made it before seeing a newer remote, or the other device's
  // clock runs ahead. This is what actually makes "set language on the phone"
  // stick against a fast-clocked PC.
  const dirty = dirtySections();
  for (const { name, t } of restampDirtySections()) {
    local.sections[name] = { ...local.sections[name], t };
  }
  syncDebug('reconcile: dirty=', dirty, 'remotes=', remotes.length);

  // Merge section-by-section, newest of each wins. A change to one section on
  // another device (e.g. language) can no longer drag along this device's
  // stale copy of the others.
  const merged = mergeBlobs([local, ...remotes]);
  recordSyncedPrefs(sectionFingerprint('prefs', merged.sections.prefs.data));

  // Push the merged blob to any store that differs — sending out the dirty
  // sections this device just won. Done regardless of the adopt branch below,
  // so a co-occurring remote change can't defer the push indefinitely. A store
  // whose pull FAILED is skipped: we don't know its contents, so pushing could
  // overwrite good remote data with local defaults. The next successful run
  // finds it stale (by stamp) and pushes then.
  const mergedFingerprint = blobFingerprint(merged);
  // Drop the stores we couldn't read (PULL_FAILED): we don't know their
  // contents, so pushing could overwrite good remote data with local defaults.
  const readable = settled.filter(
    (r): r is { target: SyncTarget; blob: SettingsBlob | null } => r.blob !== PULL_FAILED,
  );

  // Never let a push destroy irreplaceable content a store holds. Stamps order
  // whole SECTIONS, so a device whose prefs are merely newer wins the section
  // outright — personal dates and saved locations included, even ones another
  // device added that this one has never seen. ("Add a yahrzeit on the phone,
  // change the candle offset on the laptop, sync" is enough: the laptop's prefs
  // are newer, so the yahrzeit goes.) Losing a preference to last-write-wins is
  // recoverable — the user sets it again; losing a date someone typed is not.
  //
  // So a merge that would drop items the store holds is not pushed: it becomes
  // a conflict for the user to settle, the same dialog a fresh connect raises.
  // The exemption is `dirty` prefs, which means the user just answered this
  // question — "keep this device" marks it — so the answer isn't asked twice
  // and their deletion propagates. (A deliberate delete does prompt once, here
  // on the device it was made: without knowing which items this device ever
  // synced, a delete and a never-seen addition look identical from the blob.)
  const destructive = new Set<SyncTarget['id']>();
  if (!dirty.includes('prefs')) {
    for (const { target, blob } of readable) {
      if (blob === null || target.account === null) continue;
      if (conflicts.some((c) => c.targetId === target.id)) continue; // already quarantined
      if (removedUserItems(blob, merged) === 0) continue;
      destructive.add(target.id);
      conflicts.push({
        targetId: target.id,
        account: target.account,
        label: target.label ?? null,
        remote: blob,
        reason: 'removes-data',
      });
    }
  }

  const stale = readable.filter(
    ({ target, blob }) =>
      !destructive.has(target.id) && (!blob || blobFingerprint(blob) !== mergedFingerprint),
  );
  let pushedOk = false;
  if (stale.length > 0) {
    const pushed = await Promise.all(stale.map(({ target }) => target.push(merged)));
    pushedOk = pushed.some(Boolean);
    syncDebug('reconcile: pushed to', stale.length, 'store(s), ok=', pushedOk);
  }
  // Clear dirty only once the edit is confirmed everywhere AND no store was
  // unreadable or quarantined. If any target returned PULL_FAILED (or awaits a
  // conflict choice), keep the sections dirty — even if the push to a
  // *reachable* store succeeded — so the next run re-stamps the edit above the
  // outstanding store when it settles. Clearing on a partial success would let
  // that store, if it comes back holding a higher-stamped stale value, revert
  // the edit and propagate it back out.
  const anyUnsettled = results.some(({ blob }) => blob === PULL_FAILED) || conflicts.length > 0;
  if (dirty.length > 0 && !anyUnsettled && (pushedOk || stale.length === 0)) clearDirty(dirty);

  // Adopt the sections the merge changed locally (a remote won those). Reload
  // so the providers re-read them; adopting copies each remote stamp, so a
  // re-run can't re-adopt (no loop). Under the passive-language rule the
  // merged language is the remote's by presence (local contributed null) —
  // that difference is the rule working, not a change to adopt.
  const adopt = changedSections(local, merged).filter((name) => !(passiveLanguage && name === 'language'));
  syncDebug('reconcile: adopt=', adopt, 'conflicts=', conflicts.length);
  if (adopt.length > 0) {
    // Adoption skipped by the caller: the run did NOT settle, so the lineage
    // stays unrecorded and the foreign stores stay quarantined for blind
    // pushes; the next full run redoes (and then commits) the reconcile.
    if (!allowApply) return { outcome: 'clean', appliedLanguage: null, conflicts };
    // Breadcrumb for chasing a reload in the field (an adopt is what reloads
    // the page — see settings-sync.tsx): readable from a webview console after
    // the fact, no debug flag to pre-arm. Beyond the section names it records,
    // per adopted section, which store the winning copy came from, both sides'
    // stamps, and the first differing bytes of the two fingerprints — enough
    // to name the exact field that diverged without reproducing the race.
    try {
      const fpOf = (name: SectionName, blob: SettingsBlob) => sectionFingerprint(name, blob.sections[name].data);
      const detail = Object.fromEntries(
        adopt.map((name) => {
          const localFp = fpOf(name, local);
          const winnerFp = fpOf(name, merged);
          const source =
            readable.find(({ blob }) => blob !== null && fpOf(name, blob) === winnerFp)?.target.id ?? 'local';
          let i = 0;
          while (i < Math.min(localFp.length, winnerFp.length) && localFp[i] === winnerFp[i]) i++;
          return [
            name,
            {
              source,
              localT: local.sections[name].t,
              winnerT: merged.sections[name].t,
              localLen: localFp.length,
              winnerLen: winnerFp.length,
              diffAt: i,
              local: localFp.slice(Math.max(0, i - 30), i + 50),
              winner: winnerFp.slice(Math.max(0, i - 30), i + 50),
            },
          ];
        }),
      );
      window.localStorage.setItem(
        'zmanim:sync-last-adopt:v1',
        JSON.stringify({ at: new Date().toISOString(), adopt, detail }),
      );
    } catch {
      // Diagnostics only.
    }
    applyBlobSections(merged, adopt);
    commitLineage();
    return {
      outcome: 'applied',
      appliedLanguage: adopt.includes('language') ? languageOf(merged) : null,
      conflicts,
    };
  }

  commitLineage();

  // A pending conflict outranks a successful push elsewhere: the run isn't
  // settled until the user chooses.
  if (conflicts.length > 0) return { outcome: 'conflict', appliedLanguage: null, conflicts };

  // Every target unreachable (all pulls failed, nothing pushed): report 'none'
  // — its documented meaning is "no store reachable" — so a manual "Sync now"
  // during an outage says it failed rather than falsely "synced".
  if (results.length > 0 && results.every(({ blob }) => blob === PULL_FAILED)) {
    return { outcome: 'none', appliedLanguage: null, conflicts };
  }

  return { outcome: stale.length > 0 && pushedOk ? 'pushed' : 'clean', appliedLanguage: null, conflicts };
}

/**
 * The conflicts belonging to the first conflict's account. Both resolution
 * helpers act on ONE account per call: conflicts from two different accounts
 * (Telegram + Google both freshly connected) have mutually incomparable
 * stamps, so merging them would resolve their differences arbitrarily — and
 * recording the second account's lineage without resolving it would
 * un-quarantine it. The unresolved account's conflict simply resurfaces on
 * the next run and gets its own dialog.
 */
function sameAccountGroup(conflicts: SyncConflict[]): SyncConflict[] {
  return conflicts.filter((c) => c.account === conflicts[0].account);
}

/** The outcome of "use account settings"; on ok=false nothing was changed. */
export interface AdoptResult {
  ok: boolean;
  /** The adopted language when ok (or null); the caller reloads via reloadForSync. */
  language: string | null;
}

/**
 * Resolve a connect conflict the account's way: every section the account
 * holds replaces this device's copy (sections it never stored keep their local
 * values and will seed it on the next push). Stamped as a fresh user edit so
 * the choice also propagates to any other connected store instead of being
 * out-voted by its older stamps. The caller reloads via reloadForSync — the
 * post-reload reconcile does the pushes.
 */
export async function adoptAccountSettings(
  conflicts: SyncConflict[],
  targetsOverride?: SyncTarget[],
): Promise<AdoptResult> {
  if (conflicts.length === 0) return { ok: true, language: null };
  const group = sameAccountGroup(conflicts);
  // Re-pull before adopting: the dialog may have sat open while another device
  // pushed newer data to this account — restamping the stale snapshot as a
  // fresh edit would then overwrite that update everywhere. A pull we can't
  // complete means the account's CURRENT contents are unknown, so the
  // resolution ABORTS (nothing applied, store still quarantined — the user
  // retries); adopting the snapshot instead would reopen exactly that
  // overwrite. A pull that reads EMPTY is the truth — the data was deleted
  // meanwhile — so there is nothing to adopt (and nothing to resurrect).
  const targets = targetsOverride ?? (await activeSyncTargets());
  const pulls: SettingsBlob[] = [];
  for (const conflict of group) {
    const target = targets.find((t) => t.id === conflict.targetId && t.account === conflict.account);
    const fresh = target ? await target.pull() : PULL_FAILED;
    if (fresh === PULL_FAILED) return { ok: false, language: null };
    if (fresh !== null) pulls.push(fresh);
  }
  let language: string | null = null;
  if (pulls.length > 0) {
    const remote = mergeBlobs(pulls);
    const names = SECTION_NAMES.filter((name) => remote.sections[name].data !== null);
    applyBlobSections(remote, names);
    for (const name of names) markUserEdit(name);
    if (names.includes('language')) language = languageOf(remote);
  }
  for (const { targetId, account } of group) recordLineage(targetId, account);
  return { ok: true, language };
}

/**
 * Resolve a connect conflict the device's way: this device's settings are
 * stamped as a fresh user edit (so they win the merge) and the lineage is
 * recorded, un-quarantining the store. The caller runs runSync() next, which
 * pushes them over the account's stored copy — and may still adopt sections
 * the device never set ('applied' → reload), since absence loses to presence.
 */
export function keepDeviceSettings(conflicts: SyncConflict[]): void {
  if (conflicts.length === 0) return;
  const local = collectSettingsBlob();
  for (const name of SECTION_NAMES) {
    // The Mini App's page locale is the bot's launch path, not a device
    // setting — stamping it as an edit would push it over the account's
    // language (see the passive-language rule in reconcileTargets).
    if (name === 'language' && isTelegramMiniApp()) continue;
    if (local.sections[name].data !== null) markUserEdit(name);
  }
  for (const { targetId, account } of sameAccountGroup(conflicts)) recordLineage(targetId, account);
}

/**
 * Send the current local settings out after a change (callers stamp the edited
 * sections first). This is a full reconcile — pull, merge, push — with adoption
 * switched off, NOT a blind write: it used to push the local blob straight over
 * every store, which meant an edit here silently destroyed anything another
 * device had added since this one last synced (a section is won whole, so the
 * newer prefs take their personal dates with them). Pulling first lets the
 * merge keep both sides and lets the destructive-push guard speak up.
 *
 * Adoption stays off because this runs while the user is using the app: the
 * merged blob still goes out, but newer remote sections are not written to
 * localStorage under the mounted providers (that needs a reload, which the
 * startup reconcile owns). They are picked up on the next load.
 */
export async function pushLocalSettings(): Promise<void> {
  await runSync({ allowApply: false });
}

/**
 * Apply a blob the user explicitly imported (link or file). Every section is
 * re-stamped to now, so the import wins over every connected store on the next
 * sync. The caller reloads (via reloadForSync, to honor the imported language).
 */
export function applyImportedSettings(blob: SettingsBlob): SettingsBlob {
  const now = new Date().toISOString();
  const restamped: SettingsBlob = {
    v: 2,
    sections: Object.fromEntries(
      SECTION_NAMES.map((name) => [name, { data: blob.sections[name].data, t: now }]),
    ) as SettingsBlob['sections'],
  };
  applyBlobSections(restamped, [...SECTION_NAMES]);
  return restamped;
}

const LOCALES = ['en', 'he', 'ru'];
const DEFAULT_LOCALE = 'en';

/**
 * The path for `locale` under next-intl's `as-needed` prefixing: the default
 * locale is unprefixed (`/…`), the others carry a `/he`|`/ru` prefix. Strips
 * any existing locale prefix first.
 */
export function localizedPath(pathname: string, locale: string): string {
  const segments = pathname.split('/');
  if (LOCALES.includes(segments[1])) segments.splice(1, 1); // drop existing prefix
  const base = segments.join('/') || '/';
  if (locale === DEFAULT_LOCALE) return base;
  return base === '/' ? `/${locale}` : `/${locale}${base}`;
}

/**
 * Point next-intl's locale-detection cookie at `locale`. Without this, a raw
 * navigation to the DEFAULT locale's unprefixed path (`/`) is redirected by
 * the middleware straight back to the previous locale's prefix (`/ru`) — the
 * cookie, not the URL, wins for the unprefixed default. (Prefixed locales like
 * /he, /ru are unaffected, which is why only switches to English broke.) The
 * next-intl router sets this itself, but reloadForSync navigates raw so it
 * must set it too. `NEXT_LOCALE` is next-intl's default cookie name.
 */
function setLocaleCookie(locale: string): void {
  try {
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies disabled — the navigation still targets the right path for
    // prefixed locales; only the unprefixed default can misbehave.
  }
}

/**
 * sessionStorage flag: the automatic startup reconcile has already reloaded
 * once in this tab session. Session-scoped on purpose — a fresh open gets a
 * fresh single-reload budget; localStorage would block it forever.
 */
const STARTUP_RELOAD_KEY = 'zmanim:sync-startup-reloaded:v1';

/**
 * Gate for the automatic startup-reconcile reload: true the first time in a tab
 * session, false after (and it marks itself consumed). One reload is enough —
 * it adopts every newer remote section at once — so a *second* startup reload in
 * the same session only ever means the stamp-copy convergence failed and we're
 * looping.
 *
 * That used to happen inside the Telegram Mini App, which re-applied the bot's
 * structured location on every mount: it could disagree with the `web_prefs`
 * blob's location and lose the fingerprint tie-break, so reconcile re-adopted
 * and reloaded forever (until a debounced push happened to win a race). The
 * bot's location now only seeds a device that has none, so that driver is gone
 * — but this cap stays as the backstop for any future mount-time write. The
 * residual difference converges silently via the normal push. User-gesture
 * reloads (Sync now, import) don't go through here, so they're unaffected.
 */
export function consumeStartupReload(): boolean {
  try {
    if (window.sessionStorage.getItem(STARTUP_RELOAD_KEY) === '1') return false;
    window.sessionStorage.setItem(STARTUP_RELOAD_KEY, '1');
    return true;
  } catch {
    // sessionStorage unavailable — can't guard; fall back to the old behavior.
    return true;
  }
}

/**
 * Reload the page to pick up applied settings. When `language` differs from
 * the current locale it navigates to that locale's path (a full load, so the
 * whole app re-reads localStorage AND renders in the new language); otherwise
 * a plain reload. Call after runSync returns 'applied', or after an import.
 */
export function reloadForSync(language?: string | null): void {
  const current = typeof document !== 'undefined' ? document.documentElement.lang : '';
  if (language && LOCALES.includes(language) && language !== current) {
    setLocaleCookie(language);
    const { pathname, search } = window.location;
    window.location.assign(localizedPath(pathname, language) + search);
    return;
  }
  // Plain reload: pin the cookie to the current locale first, so reloading the
  // unprefixed default (`/`) can't be redirected away by a stale cookie.
  if (LOCALES.includes(current)) setLocaleCookie(current);
  window.location.reload();
}
