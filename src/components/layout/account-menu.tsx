'use client';

import { CircleUser } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SettingsDialogShell } from '@/components/layout/settings-shell';
import { SyncBackupTool } from '@/components/tools/sync-backup';

/**
 * Account button: opens sign-in / Sync & backup directly. Used on phones (see
 * app.tsx), where it takes the header's left slot in place of the wordmark, so
 * account/sync is one tap away instead of buried in Settings.
 */
export function AccountMenu({ className }: { className?: string }) {
  const t = useTranslations('export');
  return (
    <SettingsDialogShell icon={CircleUser} label={t('syncName')} title={t('syncName')} triggerClassName={className}>
      <SyncBackupTool />
    </SettingsDialogShell>
  );
}
