'use client';

import { Sunrise } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

export function SiteHeader({ right }: { right?: ReactNode }) {
  const t = useTranslations();
  return (
    <header className="bg-card/80 supports-[backdrop-filter]:bg-card/60 sticky top-0 z-30 shrink-0 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[2200px] items-center justify-between gap-2 px-4">
        <Link href="/" className="flex items-center gap-2">
          <Sunrise className="text-primary size-6" />
          <span className="text-lg font-semibold tracking-tight">{t('brand')}</span>
        </Link>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}
