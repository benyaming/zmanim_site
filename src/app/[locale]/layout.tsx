import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import '../globals.css';

import { AccessibilityProvider } from '@/components/providers/accessibility-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { dirForLocale, routing } from '@/i18n/routing';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('metaTitle'), template: `%s · ${SITE_NAME}` },
    description: t('metaDescription'),
    applicationName: SITE_NAME,
    appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      ],
      apple: '/icon-192.png',
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={dirForLocale(locale)}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Apply saved accessibility prefs before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem('zmanim:a11y:v1')||'{}');var e=document.documentElement;if(p.fontScale&&p.fontScale!=='default')e.classList.add('text-scale-'+p.fontScale);if(p.reduceMotion)e.classList.add('reduce-motion');if(p.highContrast)e.classList.add('high-contrast');}catch(e){}})();`,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AccessibilityProvider>
            <NextIntlClientProvider>{children}</NextIntlClientProvider>
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
