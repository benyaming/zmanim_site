import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { LegalPage } from '@/components/layout/legal-page';
import { routing } from '@/i18n/routing';
import { TERMS, type LegalLocale } from '@/lib/legal';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const doc = TERMS[locale as LegalLocale] ?? TERMS.en;
  return {
    title: doc.title,
    description: doc.lede,
    alternates: { canonical: '/terms' },
  };
}

export default async function TermsOfUsePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} doc={TERMS[locale as LegalLocale] ?? TERMS.en} />;
}
