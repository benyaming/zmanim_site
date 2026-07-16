'use client';

import { MonitorDown, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FontScale, useAccessibility } from '@/components/providers/accessibility-provider';
import { type Theme, useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { isIosFamily, promptInstall, useInstallPrompt } from '@/hooks/use-install-prompt';
import { useIsMiniApp } from '@/hooks/use-mini-app';

import { SettingsDialogShell } from './settings-shell';

const FONT_SCALES: { value: FontScale; px: string }[] = [
  { value: 'default', px: '13px' },
  { value: 'lg', px: '15px' },
  { value: 'xl', px: '17px' },
  { value: 'xxl', px: '19px' },
];

/**
 * "Install app" section: re-offers the PWA install for users who skipped the
 * browser's own suggestion. When the stashed `beforeinstallprompt` event is
 * available the button re-triggers the native prompt; otherwise (iOS, Firefox,
 * prompt already consumed) short manual instructions are shown instead.
 */
function InstallAppSection() {
  const t = useTranslations('settings');
  const status = useInstallPrompt();

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{t('installTitle')}</p>
      {status === 'installed' ? (
        <p className="text-muted-foreground text-sm">{t('installDone')}</p>
      ) : status === 'available' ? (
        <>
          <Button variant="outline" size="sm" className="w-full" onClick={() => void promptInstall()}>
            <MonitorDown className="size-4" />
            {t('installButton')}
          </Button>
          <p className="text-muted-foreground text-sm">{t('installHint')}</p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">{isIosFamily() ? t('installManualIos') : t('installManual')}</p>
      )}
    </div>
  );
}

/** Appearance menu: theme + accessibility (text size, motion, contrast) + app install. */
export function AppearanceSettings() {
  const t = useTranslations('settings');
  const { theme, setTheme } = useTheme();
  const { fontScale, setFontScale, reduceMotion, setReduceMotion, highContrast, setHighContrast } = useAccessibility();
  // Telegram's webview can't install a PWA — the whole section is noise there.
  const isMiniApp = useIsMiniApp();

  return (
    <SettingsDialogShell icon={Palette} label={t('appearanceOpen')} title={t('appearanceTitle')}>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('theme')}</p>
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(v) => v && setTheme(v as Theme)}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <ToggleGroupItem value="light" className="flex-1">
            {t('themeLight')}
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className="flex-1">
            {t('themeDark')}
          </ToggleGroupItem>
          <ToggleGroupItem value="system" className="flex-1">
            {t('themeSystem')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator />

      <div className="space-y-4">
        <p className="text-sm font-semibold">{t('accessibility')}</p>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('textSize')}</p>
          <ToggleGroup
            type="single"
            value={fontScale}
            onValueChange={(v) => v && setFontScale(v as FontScale)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {FONT_SCALES.map(({ value, px }) => (
              <ToggleGroupItem key={value} value={value} aria-label={t(`size_${value}`)} className="flex-1">
                <span style={{ fontSize: px }}>A</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{t('reduceMotion')}</span>
          <Button
            variant={reduceMotion ? 'default' : 'outline'}
            size="sm"
            aria-pressed={reduceMotion}
            onClick={() => setReduceMotion(!reduceMotion)}
          >
            {reduceMotion ? t('on') : t('off')}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{t('highContrast')}</span>
          <Button
            variant={highContrast ? 'default' : 'outline'}
            size="sm"
            aria-pressed={highContrast}
            onClick={() => setHighContrast(!highContrast)}
          >
            {highContrast ? t('on') : t('off')}
          </Button>
        </div>
      </div>

      {!isMiniApp && (
        <>
          <Separator />
          <InstallAppSection />
        </>
      )}
    </SettingsDialogShell>
  );
}
