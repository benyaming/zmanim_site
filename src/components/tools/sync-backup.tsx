'use client';

import { Copy, FileDown, FileUp, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useIsMiniApp } from '@/hooks/use-mini-app';
import { Link } from '@/i18n/navigation';
import { downloadBlob } from '@/lib/export/download';
import {
  GOOGLE_AUTH_EVENT,
  googleAccountDisplayName,
  googleLoginConfigured,
  loadGoogleAccount,
  mountGoogleSignInButton,
  signOutFromGoogle,
  type GoogleAccount,
} from '@/lib/google/web-login';
import { applyImportedSettings, reloadForSync, runSync } from '@/lib/sync/engine';
import { deleteGoogleWebSync } from '@/lib/sync/google-websync';
import {
  buildSettingsLink,
  parseSettingsFile,
  SETTINGS_FILE_NAME,
  settingsFileBlob,
} from '@/lib/sync/transfer';
import { botSyncEnabled } from '@/lib/telegram/bot-sync';
import {
  clearTelegramWebAuth,
  loadTelegramWebAuth,
  mountTelegramLoginWidget,
  saveTelegramWebAuth,
  telegramWebLoginConfigured,
  webAuthDisplayName,
  type TelegramWebAuth,
} from '@/lib/telegram/web-login';
import { showToast } from '@/lib/toast';
import type { SettingsBlob } from '@/lib/sync/blob';

/**
 * Sync & backup tool: connect a sync account (Telegram / Google) and move
 * settings between devices with a link or a file. The sync engine itself runs
 * app-wide (see providers/settings-sync.tsx); this tool is its control panel.
 */
export function SyncBackupTool() {
  const t = useTranslations('sync');
  const isMiniApp = useIsMiniApp();

  const [webAuth, setWebAuth] = useState<TelegramWebAuth | null>(() => loadTelegramWebAuth());
  const [googleAccount, setGoogleAccount] = useState<GoogleAccount | null>(() => loadGoogleAccount());
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<SettingsBlob | null>(null);
  const [confirmingGoogleDelete, setConfirmingGoogleDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  /** Reconcile now (a user gesture). */
  const syncNow = async (connectFlow: boolean) => {
    setBusy(true);
    try {
      const { outcome, appliedLanguage } = await runSync();
      if (outcome === 'applied') {
        reloadForSync(appliedLanguage);
        return;
      }
      // 'conflict': the account's data clashes with this device's — the sync
      // provider's dialog takes over, so no toast here.
      if (outcome === 'conflict') return;
      showToast(outcome === 'none' ? 'sync.syncFailed' : connectFlow ? 'sync.connected' : 'sync.synced');
    } finally {
      setBusy(false);
    }
  };

  /**
   * One sync account at a time: each provider's sign-in is withheld while the
   * other is connected. Two connected stores would mirror every setting into
   * two unrelated accounts, and a device holding both would silently bridge
   * data between a Telegram-only device and a Google-only one. Switching is
   * therefore disconnect-then-sign-in, which also makes it plain what happens
   * to the data.
   *
   * This panel only decides what's OFFERED. The rule itself is enforced in
   * lib/sync/engine.ts (activeSyncTargets), which syncs at most one account no
   * matter what credentials a device holds — so a device that paired both
   * before this gate is covered too: Telegram wins there, and the Google
   * account is shown here as connected-but-inactive rather than pretending to
   * sync. Keep the precedence below in step with the engine's.
   */
  // Mount Telegram's Login Widget while signed out (plain site only).
  const showTelegramLogin = !isMiniApp && telegramWebLoginConfigured() && !webAuth && !googleAccount;
  useEffect(() => {
    if (!showTelegramLogin || !widgetRef.current) return;
    return mountTelegramLoginWidget(widgetRef.current, (auth) => {
      saveTelegramWebAuth(auth);
      setWebAuth(auth);
      void syncNow(true);
    });
  }, [showTelegramLogin]);

  /**
   * The Google account is a plain-website affair. Inside the Mini App the
   * Telegram account already syncs everything through the bot.
   */
  const showGoogleSection = !isMiniApp && googleLoginConfigured();

  /**
   * Signed in with Google, but the engine won't sync it: a Telegram account is
   * connected and takes precedence (activeSyncTargets). Only reachable on a
   * device that paired both before the sign-ins became mutually exclusive.
   */
  const googleSidelined = Boolean(googleAccount && webAuth);

  // React to sign-in / sign-out / invalidation from anywhere (e.g. a sync that
  // hit a 401 after a bot-token rotation drops the credential) so an open panel
  // reflects it live instead of showing a stale "signed in".
  useEffect(() => {
    const refresh = () => setGoogleAccount(loadGoogleAccount());
    window.addEventListener(GOOGLE_AUTH_EVENT, refresh);
    return () => window.removeEventListener(GOOGLE_AUTH_EVENT, refresh);
  }, []);

  // Render Google's official sign-in button while signed out. Signing in is
  // the only Google interaction — after it, syncs go through the bot.
  const showGoogleSignIn = showGoogleSection && !googleAccount && !webAuth;
  useEffect(() => {
    if (!showGoogleSignIn || !googleButtonRef.current) return;
    return mountGoogleSignInButton(googleButtonRef.current, (account) => {
      if (!account) {
        showToast('sync.syncFailed'); // exchange with the bot failed after the chooser
        return;
      }
      setGoogleAccount(account);
      // The reconcile after sign-in is done by the settings-sync provider on
      // GOOGLE_AUTH_EVENT, so it runs even if this panel is closed mid-flow.
    });
  }, [showGoogleSignIn]);

  // Erase the account's settings from the bot, then sign out. This is the only
  // deletion path for a Google user — support can't locate their opaque row,
  // so it must be self-service while the credential is still on the device.
  const deleteGoogleData = async () => {
    if (!googleAccount) return;
    setBusy(true);
    try {
      const ok = await deleteGoogleWebSync(googleAccount);
      setConfirmingGoogleDelete(false);
      if (!ok) {
        showToast('sync.syncFailed');
        return;
      }
      signOutFromGoogle();
      setGoogleAccount(null);
      showToast('sync.googleDeleted');
    } finally {
      setBusy(false);
    }
  };

  const onImportFile = async (file: File) => {
    const blob = parseSettingsFile(await file.text());
    if (!blob) {
      showToast('sync.importInvalid');
      return;
    }
    setPendingFile(blob);
  };

  const copyLink = async () => {
    const link = buildSettingsLink();
    if (!link) {
      showToast('sync.syncFailed');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      showToast('sync.linkCopied');
    } catch {
      // Clipboard blocked (permissions, non-secure context) — offer the file path instead.
      showToast('sync.linkCopyFailed');
    }
  };

  const showTelegramSection = isMiniApp || telegramWebLoginConfigured();

  return (
    <div className="space-y-6">
      {showTelegramSection && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('telegramTitle')}</p>
          {isMiniApp ? (
            <>
              <p className="text-muted-foreground text-sm">{botSyncEnabled() ? t('miniAppSynced') : t('miniAppNoApi')}</p>
              {botSyncEnabled() && (
                <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => void syncNow(false)}>
                  <RefreshCw className="size-4" />
                  {t('syncNow')}
                </Button>
              )}
            </>
          ) : webAuth ? (
            <>
              <p className="text-muted-foreground text-sm">{t('tgConnected', { name: webAuthDisplayName(webAuth) })}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" disabled={busy} onClick={() => void syncNow(false)}>
                  <RefreshCw className="size-4" />
                  {t('syncNow')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    clearTelegramWebAuth();
                    setWebAuth(null);
                  }}
                >
                  {t('disconnect')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{googleAccount ? t('tgBlocked') : t('tgHint')}</p>
              {/* The Login Widget script renders its iframe button in here. */}
              {showTelegramLogin && <div ref={widgetRef} className="flex min-h-10 justify-center" />}
            </>
          )}
        </div>
      )}

      {showGoogleSection && (
        <>
          {showTelegramSection && <Separator />}
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('googleTitle')}</p>
            {googleAccount ? (
              <>
                <div className="flex items-center gap-2">
                  {/* Initials, not the remote Google avatar: rendering that URL
                      would hit Google's image servers and leak the user's IP
                      every time the panel opens — contradicting the privacy
                      promise that the site never contacts Google after sign-in. */}
                  <div
                    aria-hidden
                    className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium"
                  >
                    {(googleAccountDisplayName(googleAccount)[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {googleAccountDisplayName(googleAccount)
                        ? t('googleSignedInAs', { name: googleAccountDisplayName(googleAccount) })
                        : t('googleSignedIn')}
                    </p>
                    {googleAccount.name && googleAccount.email && (
                      <p className="text-muted-foreground truncate text-xs">{googleAccount.email}</p>
                    )}
                  </div>
                </div>
                {/* No "Sync now" while sidelined: the run would sync Telegram,
                    not this account — offering it under the Google heading
                    would claim a sync that never happens. */}
                {googleSidelined && <p className="text-muted-foreground text-sm">{t('googleInactive')}</p>}
                <div className="flex gap-2">
                  {!googleSidelined && (
                    <Button variant="outline" size="sm" className="flex-1" disabled={busy} onClick={() => void syncNow(false)}>
                      <RefreshCw className="size-4" />
                      {t('syncNow')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      signOutFromGoogle();
                      setGoogleAccount(null);
                    }}
                  >
                    {t('signOut')}
                  </Button>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmingGoogleDelete(true)}
                  className="text-muted-foreground hover:text-destructive self-start text-xs underline underline-offset-2 disabled:opacity-50"
                >
                  {t('googleDelete')}
                </button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">{webAuth ? t('googleBlocked') : t('googleHint')}</p>
                {showGoogleSignIn && (
                  <>
                    {/* Google's own rendered button owns the sign-in gesture. */}
                    <div ref={googleButtonRef} className="flex justify-center" />
                    <p className="text-muted-foreground text-xs">
                      {t.rich('googleStored', {
                        link: (chunks) => (
                          <Link
                            href="/privacy"
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground underline underline-offset-2"
                          >
                            {chunks}
                          </Link>
                        ),
                      })}
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {(showTelegramSection || showGoogleSection) && <Separator />}

      <div className="space-y-2">
        <p className="text-sm font-semibold">{t('transferTitle')}</p>
        <p className="text-muted-foreground text-sm">{t('transferHint')}</p>
        <div className="grid gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyLink()}>
            <Copy className="size-4" />
            {t('copyLink')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void downloadBlob(settingsFileBlob(), SETTINGS_FILE_NAME)}
          >
            <FileDown className="size-4" />
            {t('downloadFile')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="size-4" />
            {t('importFile')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void onImportFile(file);
            }}
          />
        </div>
        {pendingFile && (
          <div className="bg-muted/50 space-y-2 rounded-lg border p-3">
            <p className="text-sm">{t('importBody')}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPendingFile(null)}>
                {t('importCancel')}
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  const language = pendingFile.sections.language.data;
                  applyImportedSettings(pendingFile);
                  reloadForSync(typeof language === 'string' ? language : null);
                }}
              >
                {t('importApply')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={confirmingGoogleDelete} onOpenChange={(open) => !busy && setConfirmingGoogleDelete(open)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('googleDeleteTitle')}</DialogTitle>
            <DialogDescription>{t('googleDeleteBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setConfirmingGoogleDelete(false)}>
              {t('importCancel')}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void deleteGoogleData()}>
              {t('googleDeleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
