import { getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { LEGAL_UPDATED, type LegalDoc } from '@/lib/legal';

/**
 * Shared shell for the privacy policy and terms of use: a plain, readable
 * document page. Both are static text, so this is a server component and the
 * routes prerender per locale.
 */
export async function LegalPage({ locale, doc }: { locale: string; doc: LegalDoc }) {
  const t = await getTranslations({ locale, namespace: 'legal' });

  // Format from explicit UTC parts: `new Date('2026-07-22')` is UTC midnight,
  // which renders as the previous day west of Greenwich.
  const [year, month, day] = LEGAL_UPDATED.split('-').map(Number);
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader right={<LanguageSwitcher />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{doc.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('updated', { date: updated })}</p>
        <p className="mt-4 text-[0.9375rem] leading-relaxed">{doc.lede}</p>

        <div className="mt-8 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-muted-foreground text-[0.9375rem] leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
