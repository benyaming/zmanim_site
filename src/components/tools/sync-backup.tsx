'use client';

import { Copy, FileDown, FileUp, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useIsMiniApp } from '@/hooks/use-mini-app';
import { downloadBlob } from '@/lib/export/download';
import { applyImportedSettings, reloadForSync, runSync } from '@/lib/sync/engine';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  googleSyncConfigured,
  googleSyncConnected,
} from '@/lib/sync/google-drive';
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
 * Sync & backup tool: connect a sync account (Telegram / Google Drive) and
 * move settings between devices with a link or a file. The sync engine
 * itself runs app-wide (see providers/settings-sync.tsx); this tool is its
 * control panel.
 */
export function SyncBackupTool() {
  const t = useTranslations('sync');
  const isMiniApp = useIsMiniApp();

  const [webAuth, setWebAuth] = useState<TelegramWebAuth | null>(() => loadTelegramWebAuth());
  const [googleOn, setGoogleOn] = useState(() => googleSyncConnected());
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<SettingsBlob | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  /** Reconcile now; a user gesture, so Google may open its popup. */
  const syncNow = async (connectFlow: boolean) => {
    setBusy(true);
    try {
      const { outcome, appliedLanguage } = await runSync({ interactive: true });
      if (outcome === 'applied') {
        reloadForSync(appliedLanguage);
        return;
      }
      showToast(outcome === 'none' ? 'sync.syncFailed' : connectFlow ? 'sync.connected' : 'sync.synced');
    } finally {
      setBusy(false);
    }
  };

  // Mount Telegram's Login Widget while signed out (plain site only).
  const showTelegramLogin = !isMiniApp && telegramWebLoginConfigured() && !webAuth;
  useEffect(() => {
    if (!showTelegramLogin || !widgetRef.current) return;
    return mountTelegramLoginWidget(widgetRef.current, (auth) => {
      saveTelegramWebAuth(auth);
      setWebAuth(auth);
      void syncNow(true);
    });
  }, [showTelegramLogin]);

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
              <p className="text-muted-foreground text-sm">{t('tgHint')}</p>
              {/* The Login Widget script renders its iframe button in here. */}
              <div ref={widgetRef} className="flex min-h-10 justify-center" />
            </>
          )}
        </div>
      )}

      {googleSyncConfigured() && (
        <>
          {showTelegramSection && <Separator />}
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('googleTitle')}</p>
            {googleOn ? (
              <>
                <p className="text-muted-foreground text-sm">{t('googleConnected')}</p>
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
                      disconnectGoogleDrive();
                      setGoogleOn(false);
                    }}
                  >
                    {t('disconnect')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">{t('googleHint')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void connectGoogleDrive()
                      .then((ok) => {
                        setBusy(false);
                        if (!ok) {
                          showToast('sync.syncFailed');
                          return;
                        }
                        setGoogleOn(true);
                        return syncNow(true);
                      });
                  }}
                >
                  {t('googleConnect')}
                </Button>
              </>
            )}
          </div>
        </>
      )}

      {(showTelegramSection || googleSyncConfigured()) && <Separator />}

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
    </div>
  );
}
