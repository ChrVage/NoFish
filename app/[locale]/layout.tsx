import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { Suspense } from 'react';
import { routing } from '@/i18n/routing';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import '../globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const localeNames: Record<string, string> = {
  no: 'nb_NO',
  en: 'en_US',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  const title = t('metaTitle');
  const description = t('metaDescription');
  const canonicalUrl = locale === routing.defaultLocale ? 'https://nofish.no' : `https://nofish.no/${locale}`;

  const hreflangAlternates: Record<string, string> = {};
  for (const l of routing.locales) {
    hreflangAlternates[localeNames[l] ?? l] = l === routing.defaultLocale
      ? 'https://nofish.no'
      : `https://nofish.no/${l}`;
  }

  return {
    metadataBase: new URL('https://nofish.no'),
    title,
    description,
    referrer: 'no-referrer-when-downgrade',
    icons: {
      icon: [
        { url: '/favicon.ico?v=20260424' },
        { url: '/favicon.svg?v=20260424', type: 'image/svg+xml' },
        { url: '/favicon-96x96.png?v=20260424', sizes: '96x96', type: 'image/png' },
      ],
      apple: [{ url: '/apple-touch-icon.png?v=20260424', sizes: '180x180', type: 'image/png' }],
      shortcut: ['/favicon.ico?v=20260424'],
    },
    manifest: '/site.webmanifest?v=20260424',
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'NoFish.no',
      images: [
        {
          url: 'https://nofish.no/marine-weather-security-forecast-og.jpg',
          width: 1200,
          height: 630,
          alt: 'NoFish.no — Fishing Forecast Map for Small Boats',
        },
      ],
      locale: localeNames[locale] ?? locale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://nofish.no/marine-weather-security-forecast-og.jpg'],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: hreflangAlternates,
    },
  };
}

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'NoFish.no',
    url: 'https://nofish.no',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://nofish.no/?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'NoFish.no',
    url: 'https://nofish.no',
    applicationCategory: 'WeatherApplication',
    operatingSystem: 'Web',
    description:
      'Because fishing in bad weather is worse than no fishing at all. Get precise wind, wave, and tide maps curated for small boat safety.',
    genre: 'Fishing',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'NOK',
    },
  },
];

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <div style={{ position: 'fixed', bottom: '1rem', left: '1rem', zIndex: 50 }}>
            <Suspense>
              <LocaleSwitcher />
            </Suspense>
          </div>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
