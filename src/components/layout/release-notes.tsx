'use client';

import { DateTime } from 'luxon';
import { useLocale, useTranslations } from 'next-intl';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { APP_VERSION, RELEASES, releaseNotes } from '@/lib/releases';

/**
 * The footer's version indicator; pressing it opens the release-notes pane.
 * The pane slides in from the reading-end side (left in the RTL locale).
 */
export function ReleaseNotesPane() {
  const t = useTranslations('releases');
  const locale = useLocale();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground/70 hover:text-foreground whitespace-nowrap tabular-nums transition-colors"
        >
          {t('changelog')} · v{APP_VERSION}
        </button>
      </SheetTrigger>
      <SheetContent side={locale === 'he' ? 'left' : 'right'} className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('subtitle')}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          {RELEASES.map((release) => (
            <section key={release.version}>
              <h3 className="text-foreground font-medium">
                {/* dir="ltr" isolates the version from the date: in RTL the two
                    otherwise merge into one bidi run ("v1.0" + "3 ביולי" → "v1.03 ביולי"). */}
                <span dir="ltr">v{release.version}</span>
                <span className="text-muted-foreground ms-2 text-xs font-normal">
                  {DateTime.fromISO(release.date).setLocale(locale).toLocaleString(DateTime.DATE_MED)}
                </span>
              </h3>
              <ul className="text-muted-foreground mt-1.5 list-disc space-y-1 ps-5 text-sm">
                {releaseNotes(release, locale).map((note, i) => (
                  // Index keys are fine here: the list is static per release.
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
