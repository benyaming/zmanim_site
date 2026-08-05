'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { useAccessibility } from '@/components/providers/accessibility-provider';
import { useAppState } from '@/components/providers/app-state';
import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  collectSettingsBlob,
  lastSyncedPrefs,
  sectionFingerprint,
  stampSection,
  type SettingsBlob,
} from '@/lib/sync/blob';
import { clearLegacyGoogleKeys, GOOGLE_AUTH_EVENT, loadGoogleAccount } from '@/lib/google/web-login';
import {
  adoptAccountSettings,
  applyImportedSettings,
  consumeStartupReload,
  keepDeviceSettings,
  pushLocalSettings,
  reloadForSync,
  runSync,
  SYNC_CONFLICT_EVENT,
  type SyncConflict,
} from '@/lib/sync/engine';
import { settingsFromHash } from '@/lib/sync/transfer';
import { showToast } from '@/lib/toast';

/**
 * Captured at module load, before the app-state URL-reflect effect rewrites
 * the URL and drops the fragment (same pattern as telegram/mini-app.ts).
 */
const launchHash = typeof window !== 'undefined' ? window.location.hash : '';

/** Push after a change, batched: rapid tweaks collapse into one write. */
const PUSH_DEBOUNCE_MS = 2500;

/**
 * Settings sync engine (renders only the settings-link import prompt; see
 * docs/settings-sync.md).
 *
 * On mount it reconciles with every connected store — newest snapshot wins;
 * a newer remote is applied and the page reloads so the providers pick it up.
 * Afterwards a *genuine* change to a synced setting (app prefs, text size,
 * theme, …) stamps the local snapshot and pushes it back, debounced.
 *
 * "Genuine" is the crux: on mount the app auto-detects location, backfills
 * elevation and re-resolves labels, all of which fire the change watcher
 * without the user touching anything. Pushing those would re-stamp this
 * device as the newest every load and defeat last-write-wins. So the watcher
 * compares the freshly persisted content against the fingerprint the engine
 * last synced and pushes only on a real difference.
 */
export function SettingsSync() {
  const t = useTranslations('sync');
  const {
    location,
    savedLocations,
    candleLightingOffset,
    useElevation,
    havdalahOpinion,
    lehumra,
    hiddenZmanim,
    hiddenLearning,
    hiddenFastEnd,
    personalDates,
    exportPreset,
  } = useAppState();
  const { fontScale, reduceMotion, highContrast } = useAccessibility();
  const { theme } = useTheme();

  // A settings link opened on this device — confirm before overwriting.
  const [pendingImport, setPendingImport] = useState<SettingsBlob | null>(() => settingsFromHash(launchHash));

  // A freshly connected account holds settings that clash with this device's —
  // the engine quarantined the store and the user picks a side here. Announced
  // via SYNC_CONFLICT_EVENT so it surfaces no matter which run found it
  // (startup, sign-in event, the panel's Sync now). Dismissing decides nothing:
  // the store stays quarantined and the next reconcile asks again.
  const [conflicts, setConflicts] = useState<SyncConflict[] | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  useEffect(() => {
    const onConflict = (event: Event) => setConflicts((event as CustomEvent<SyncConflict[]>).detail);
    window.addEventListener(SYNC_CONFLICT_EVENT, onConflict);
    return () => window.removeEventListener(SYNC_CONFLICT_EVENT, onConflict);
  }, []);

  // Startup reconcile. Adopting newer remote sections reloads the page so the
  // providers re-read them; a pending import skips this — the user decides
  // first. Adopting copies each remote section's stamp, so a re-run normally
  // sees them equal and won't re-adopt. The Mini App used to break that (it
  // re-applied the bot's structured location each mount, defeating the
  // fingerprint tie-break); it now only seeds a device that has none, but the
  // startup reload stays capped at once per session (consumeStartupReload) as
  // the backstop.
  useEffect(() => {
    // Purge the Drive-era localStorage keys on the way in (see web-login.ts):
    // nothing reads them, and one held an access token. Unconditional, because
    // a device that used that flow may never touch Google sign-in again.
    clearLegacyGoogleKeys();
    if (settingsFromHash(launchHash)) return;
    let cancelled = false;
    void runSync().then(({ outcome, appliedLanguage }) => {
      if (cancelled || outcome !== 'applied') return;
      if (consumeStartupReload()) reloadForSync(appliedLanguage);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A Google sign-in that lands mid-session adds a store the startup reconcile
  // never saw. Reconcile it here — NOT from the account panel's callback, which
  // is skipped if the user closes the dialog while the sign-in is in flight.
  // Without this, the change watcher's push-only sync would upload local
  // settings to the freshly connected store without first pulling, overwriting
  // its (possibly sole) remote copy. Fires on the auth event, not on sign-out
  // (guarded on an account actually being present).
  useEffect(() => {
    const onGoogleAuth = () => {
      if (!loadGoogleAccount()) return; // sign-out / invalidation — nothing to pull
      void runSync().then(({ outcome, appliedLanguage }) => {
        // Reload whenever remote sections were adopted, WITHOUT the startup
        // one-reload guard: runSync already wrote them to localStorage, and the
        // mounted providers still hold the stale values — skipping the reload
        // would let a later edit persist that stale state over what was just
        // applied. This is a one-shot, user-initiated event (not the mount
        // loop), and adopting copies the remote stamps, so it can't loop.
        if (outcome === 'applied') reloadForSync(appliedLanguage);
      });
    };
    window.addEventListener(GOOGLE_AUTH_EVENT, onGoogleAuth);
    return () => window.removeEventListener(GOOGLE_AUTH_EVENT, onGoogleAuth);
  }, []);

  // Change watcher: any synced value changing (after the mount pass) stamps
  // and pushes. The serialized tuple keeps the dependency list honest.
  const changeFingerprint = JSON.stringify([
    location,
    savedLocations,
    candleLightingOffset,
    useElevation,
    havdalahOpinion,
    lehumra,
    hiddenZmanim,
    hiddenLearning,
    hiddenFastEnd,
    personalDates,
    // The export preset rides the prefs blob, so a new one has to wake the
    // watcher: without it the preset stayed on this device until some unrelated
    // preference happened to change, and a reconcile in between could adopt the
    // account's prefs and drop it.
    exportPreset,
    fontScale,
    reduceMotion,
    highContrast,
    theme,
  ]);
  const seenFirstRender = useRef(false);
  useEffect(() => {
    if (!seenFirstRender.current) {
      seenFirstRender.current = true;
      return;
    }
    const timer = setTimeout(() => {
      // Theme, a11y and language stamp their own sections in their setters, so
      // here the watcher only owns the prefs section. Stamp it just when the
      // freshly persisted prefs differ from what the engine last synced — so
      // mount-time auto-adjustments that reproduce the synced state don't
      // re-stamp prefs and clobber another device. Then push everything (the
      // per-section stamps drive the merge).
      const prefs = sectionFingerprint('prefs', collectSettingsBlob().sections.prefs.data);
      if (prefs !== lastSyncedPrefs()) stampSection('prefs');
      void pushLocalSettings();
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [changeFingerprint]);

  if (pendingImport) {
    const dismiss = () => {
      setPendingImport(null);
      // Drop the fragment so a reload doesn't re-offer the same import.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };
    const apply = () => {
      const language = pendingImport.sections.language.data;
      applyImportedSettings(pendingImport);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      reloadForSync(typeof language === 'string' ? language : null);
    };

    return (
      <Dialog open onOpenChange={(open) => !open && dismiss()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('importTitle')}</DialogTitle>
            <DialogDescription>{t('importBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={dismiss}>
              {t('importCancel')}
            </Button>
            <Button onClick={apply}>{t('importApply')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!conflicts || conflicts.length === 0) return null;

  // One account per dialog: the engine's resolution helpers act on the first
  // conflict's account only. A second conflicting account (Telegram + Google
  // both freshly connected) resurfaces on the follow-up run and asks again.
  const group = conflicts.filter((c) => c.account === conflicts[0].account);
  const accountName =
    group.find((c) => c.label)?.label ?? (group[0].targetId === 'google-websync' ? 'Google' : 'Telegram');
  const useAccount = () => {
    setResolvingConflict(true);
    // The choice wins everywhere via its fresh stamps; the post-reload
    // reconcile pushes it out to every connected store.
    void adoptAccountSettings(group).then(({ ok, language }) => {
      // The account couldn't be re-read, so nothing was adopted — a stale
      // snapshot could overwrite a newer update from another device. The
      // dialog stays for a retry.
      if (!ok) {
        setResolvingConflict(false);
        showToast('sync.syncFailed');
        return;
      }
      reloadForSync(language);
    });
  };
  const useDevice = () => {
    setResolvingConflict(true);
    keepDeviceSettings(group);
    void runSync().then(({ outcome, appliedLanguage }) => {
      // 'applied' = the account had sections this device never set (absence
      // loses to presence) — they were just written locally, so reload.
      if (outcome === 'applied') {
        reloadForSync(appliedLanguage);
        return;
      }
      setResolvingConflict(false);
      // Another connected store raised its own conflict during this run — the
      // event listener already refreshed the dialog with it; keep it open.
      if (outcome === 'conflict') return;
      setConflicts(null);
      // A failed push isn't lost — the choice is stamped dirty and re-sent on
      // the next run — but say so instead of claiming success.
      showToast(outcome === 'pushed' ? 'sync.synced' : 'sync.syncFailed');
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !resolvingConflict && setConflicts(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('conflictTitle')}</DialogTitle>
          {/* Two ways in, two explanations: a newly connected account whose
              data clashes, or a push that would delete content the store
              holds. The choices are the same either way. */}
          <DialogDescription>
            {t(group[0].reason === 'removes-data' ? 'conflictBodyRemoves' : 'conflictBody', {
              account: accountName,
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Button className="w-full" disabled={resolvingConflict} onClick={useAccount}>
              {t('conflictUseAccount')}
            </Button>
            <p className="text-muted-foreground text-xs">{t('conflictUseAccountHint')}</p>
          </div>
          <div className="space-y-1">
            <Button variant="outline" className="w-full" disabled={resolvingConflict} onClick={useDevice}>
              {t('conflictKeepDevice')}
            </Button>
            <p className="text-muted-foreground text-xs">{t('conflictKeepDeviceHint')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
