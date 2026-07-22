import { setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';

import { LegalPage } from '@/components/layout/legal-page';
import { routing } from '@/i18n/routing';
import { PRIVACY, type LegalLocale } from '@/lib/legal';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const doc = PRIVACY[locale as LegalLocale] ?? PRIVACY.en;
  return {
    title: doc.title,
    description: doc.lede,
    alternates: { canonical: '/privacy' },
  };
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} doc={PRIVACY[locale as LegalLocale] ?? PRIVACY.en} />;
}
