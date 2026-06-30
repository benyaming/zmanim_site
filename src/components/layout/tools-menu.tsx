'use client';

import { Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SettingsDialogShell } from './settings-shell';

/** Tools menu — placeholder until the first tools ship. */
export function ToolsMenu() {
  const t = useTranslations('settings');

  return (
    <SettingsDialogShell icon={Wrench} label={t('toolsOpen')} title={t('toolsTitle')}>
      <p className="text-muted-foreground text-sm">{t('toolsComingSoon')}</p>
    </SettingsDialogShell>
  );
}
