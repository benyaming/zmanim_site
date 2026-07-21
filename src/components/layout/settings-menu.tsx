'use client';

import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CalendarSettingsBody } from '@/components/layout/calendar-settings';
import { LanguageSettingsBody } from '@/components/layout/language-settings';
import { SettingsDialogShell } from '@/components/layout/settings-shell';
import { AppearanceSettingsBody, InstallAppSection } from '@/components/layout/appearance-settings';
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
 * The single "Settings" menu: language, appearance, and (when its own header
 * button is hidden for lack of room) the calendar preferences. Sync/account
 * lives on its own header button now, not here.
 */
export function SettingsMenu({ showCalendar = false }: { showCalendar?: boolean }) {
  const t = useTranslations('settings');
  const tLang = useTranslations('language');
  const isMiniApp = useIsMiniApp();

  return (
    <SettingsDialogShell icon={Settings} label={t('settingsOpen')} title={t('settingsTitle')}>
      <Section title={tLang('label')}>
        <LanguageSettingsBody />
      </Section>

      <Separator />
      <Section title={t('appearanceTitle')}>
        <AppearanceSettingsBody />
      </Section>

      {/* Calendar preferences fold in only when the header dropped their own
          button for lack of space (see app.tsx). */}
      {showCalendar && (
        <>
          <Separator />
          <Section title={t('calendarTitle')}>
            <CalendarSettingsBody />
          </Section>
        </>
      )}

      {!isMiniApp && (
        <>
          <Separator />
          <InstallAppSection />
        </>
      )}
    </SettingsDialogShell>
  );
}
