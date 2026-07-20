'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { markUserEdit } from '@/lib/sync/blob';

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('language');
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    // Language is a synced setting held in the URL, not localStorage. The
    // switch remounts the app, so the sync watcher never sees it as a state
    // change — mark it dirty so the mount-time reconcile re-stamps this choice
    // above the other device (even under clock skew) and it wins, rather than
    // adopting an older-language remote back.
    markUserEdit('language');
    // Keep the query string: it carries the calendar state (?m/?d/?v), so
    // dropping it snapped the app back to today. Read it from the location —
    // app-state maintains it via history.replaceState, which the Next router
    // (and therefore useSearchParams) does not observe.
    router.replace(`${pathname}${window.location.search}`, { locale: next });
  };

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t('label')}>
                <Languages className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('label')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end">
        {routing.locales.map((loc) => (
          <DropdownMenuItem key={loc} onClick={() => switchTo(loc)} className={loc === locale ? 'font-semibold' : undefined}>
            {t(loc)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
