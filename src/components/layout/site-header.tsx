'use client';

import { Sunrise } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** The home-link wordmark (sun glyph + brand). */
export function BrandLink({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <Link href="/" className={cn('flex shrink-0 items-center gap-2', className)}>
      <Sunrise className="text-primary size-6" />
      {/* On very narrow screens (older ~360px phones) the wordmark starves
          the location pill and menu buttons — keep just the sun glyph. */}
      <span className="hidden text-lg font-semibold tracking-tight min-[25rem]:inline">{t('brand')}</span>
    </Link>
  );
}

export function SiteHeader({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="bg-card/80 supports-[backdrop-filter]:bg-card/60 sticky top-0 z-30 shrink-0 border-b backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[2200px] items-center justify-between gap-2 px-4">
        {/* Defaults to the brand link; the main app hides it on phones (see
            app.tsx), where the left stays empty and the controls hug the right
            corner — `ms-auto` keeps them there even when the left is gone. */}
        {left ?? <BrandLink />}
        {right && <div className="ms-auto flex min-w-0 items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}
