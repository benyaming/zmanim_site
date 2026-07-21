'use client';

import { useLocale, useTranslations } from 'next-intl';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { markUserEdit } from '@/lib/sync/blob';

/**
 * A locale switch remounts the whole [locale] tree (see CLAUDE.md), which would
 * otherwise close the Settings dialog it was picked from. This one-shot flag
 * tells the reopened SettingsMenu to open itself again, so the menu appears to
 * stay put across the language change.
 */
const REOPEN_KEY = 'zmanim:settings-reopen';

/** Whether Settings should reopen after a locale switch (read-only — pure, so
 * a StrictMode double-invoked initializer stays consistent; clear separately). */
export function peekSettingsReopen(): boolean {
  try {
    return window.sessionStorage.getItem(REOPEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearSettingsReopen(): void {
  try {
    window.sessionStorage.removeItem(REOPEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Language picker as a Settings section (replaces the old header dropdown). */
export function LanguageSettingsBody() {
  const locale = useLocale();
  const t = useTranslations('language');
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (next: string) => {
    if (!next || next === locale) return;
    // Flag the language section dirty so the sync reconcile keeps this choice;
    // remember to reopen Settings across the locale remount; and preserve the
    // calendar-state query string (?m/?d/?v) that app-state maintains via
    // history.replaceState.
    markUserEdit('language');
    try {
      window.sessionStorage.setItem(REOPEN_KEY, '1');
    } catch {
      // Reopen is best-effort; the switch itself still works.
    }
    router.replace(`${pathname}${window.location.search}`, { locale: next as Locale });
  };

  return (
    <ToggleGroup
      type="single"
      value={locale}
      onValueChange={switchTo}
      variant="outline"
      size="sm"
      className="w-full"
    >
      {routing.locales.map((loc) => (
        <ToggleGroupItem key={loc} value={loc} className="flex-1">
          {t(loc)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
