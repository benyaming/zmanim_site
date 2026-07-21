'use client';

import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CalendarSettingsBody } from '@/components/layout/calendar-settings';
import { LanguageSettingsBody } from '@/components/layout/language-settings';
import { SettingsDialogShell } from '@/components/layout/settings-shell';
import { AppearanceSettingsBody, InstallAppSection } from '@/components/layout/appearance-settings';
import { SyncBackupTool } from '@/components/tools/sync-backup';
import { Separator } from '@/components/ui/separator';
import { useIsMiniApp } from '@/hooks/use-mini-app';

/** A labelled Settings section with a small uppercase header. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-muted-foreground/70 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The single "Settings" menu: appearance, language, and sync/backup in one
 * place (replacing the old separate Appearance dialog and Language dropdown,
 * and pulling Sync out of Tools). On narrow screens — where the standalone
 * Calendar button is hidden to keep the header uncluttered — the calendar
 * preferences fold in here too, right after Appearance.
 */
export function SettingsMenu() {
  const t = useTranslations('settings');
  const tLang = useTranslations('language');
  const tExport = useTranslations('export');
  const isMiniApp = useIsMiniApp();

  return (
    <SettingsDialogShell icon={Settings} label={t('settingsOpen')} title={t('settingsTitle')}>
      <Section title={t('appearanceTitle')}>
        <AppearanceSettingsBody />
      </Section>

      {/* Calendar preferences only fold in here on phones; on sm+ they have
          their own header button (see CalendarSettings), so this stays hidden. */}
      <div className="space-y-6 sm:hidden">
        <Separator />
        <Section title={t('calendarTitle')}>
          <CalendarSettingsBody />
        </Section>
      </div>

      <Separator />
      <Section title={tLang('label')}>
        <LanguageSettingsBody />
      </Section>

      <Separator />
      <Section title={tExport('syncName')}>
        <SyncBackupTool />
      </Section>

      {!isMiniApp && (
        <>
          <Separator />
          <InstallAppSection />
        </>
      )}
    </SettingsDialogShell>
  );
}
