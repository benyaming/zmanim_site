'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DateTime } from 'luxon';

import { useAppState } from '@/components/providers/app-state';
import { getDailyLearning } from '@/lib/learning';

import { InfoHint } from './info-hint';
import { SectionHeading } from './section-heading';

/**
 * The daily-learning section of the day panel: Daf Yomi, Yerushalmi Yomi,
 * Mishna Yomit, Nach Yomi, daily Tehillim, Daily Rambam and (on its Shabbatot)
 * Pirkei Avot. Each cycle's explanation hides behind an info popover, matching
 * the zmanim list, and each reading links to its text on Sefaria.
 */
export function DailyLearning({ date, inIsrael, locale }: { date: DateTime; inIsrael: boolean; locale: string }) {
  const t = useTranslations('learning');
  const { hiddenLearning } = useAppState();
  // Display-only filter, like hidden zmanim: cycles stay computed, just not shown.
  const hidden = new Set(hiddenLearning);
  const items = getDailyLearning(date, inIsrael, locale).filter((item) => !hidden.has(item.key));
  if (items.length === 0) return null;

  return (
    <section>
      <SectionHeading>{t('title')}</SectionHeading>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-start justify-between gap-3">
            <span className="flex shrink-0 items-center gap-1">
              <span className="text-sm font-medium">{t(item.key)}</span>
              <InfoHint detail={t(`${item.key}Info`)} label={t(item.key)} />
            </span>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex min-w-0 items-center gap-1 text-end text-sm underline-offset-2 hover:underline"
              >
                {item.reading}
                <ExternalLink className="text-muted-foreground/40 group-hover:text-muted-foreground size-3 shrink-0 transition-colors" />
              </a>
            ) : (
              <span className="min-w-0 text-end text-sm">{item.reading}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
