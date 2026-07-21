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
import { applyImportedSettings, consumeStartupReload, pushLocalSettings, reloadForSync, runSync } from '@/lib/sync/engine';
import { settingsFromHash } from '@/lib/sync/transfer';

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
  } = useAppState();
  const { fontScale, reduceMotion, highContrast } = useAccessibility();
  const { theme } = useTheme();

  // A settings link opened on this device — confirm before overwriting.
  const [pendingImport, setPendingImport] = useState<SettingsBlob | null>(() => settingsFromHash(launchHash));

  // Startup reconcile. Adopting newer remote sections reloads the page so the
  // providers re-read them; a pending import skips this — the user decides
  // first. Adopting copies each remote section's stamp, so a re-run normally
  // sees them equal and won't re-adopt — but that invariant breaks inside the
  // Telegram Mini App (TelegramMiniApp re-applies the bot's structured location
  // each mount, defeating the fingerprint tie-break), so we also cap the
  // startup reload to once per session (consumeStartupReload) to stop the loop.
  useEffect(() => {
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

  if (!pendingImport) return null;

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
