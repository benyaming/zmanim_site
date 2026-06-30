'use client';

import { useTranslations } from 'next-intl';

export function SiteFooter() {
  const t = useTranslations('footer');
  return (
    <footer className="text-muted-foreground shrink-0 border-t py-2.5 text-center text-[0.6875rem] leading-tight">
      <div className="mx-auto max-w-6xl px-4 2xl:max-w-[2200px]">
        {t.rich('disclaimer', {
          link: (chunks) => (
            <a
              href="https://github.com/BehindTheMath/KosherZmanim"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground underline underline-offset-2"
            >
              {chunks}
            </a>
          ),
        })}
      </div>
    </footer>
  );
}
