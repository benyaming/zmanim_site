'use client';

import { useLocale, useTranslations } from 'next-intl';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { markUserEdit } from '@/lib/sync/blob';

/** Language picker as a Settings section (replaces the old header dropdown). */
export function LanguageSettingsBody() {
  const locale = useLocale();
  const t = useTranslations('language');
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (next: string) => {
    if (!next || next === locale) return;
    // Same as the former header switcher: flag the language section dirty so
    // the sync reconcile keeps this choice, and preserve the calendar-state
    // query string (?m/?d/?v) that app-state maintains via history.replaceState.
    markUserEdit('language');
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
