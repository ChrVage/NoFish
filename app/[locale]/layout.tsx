import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
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
  de: 'de_DE',
  nl: 'nl_NL',
  pl: 'pl_PL',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const alternates: Record<string, string> = {};
  for (const l of routing.locales) {
    alternates[localeNames[l] ?? l] = l === routing.defaultLocale
      ? 'https://nofish.no'
      : `https://nofish.no/${l}`;
  }

  return {
    title: 'NoFish.no | Fishing Forecast Map for Small Boats',
    description:
      'Because fishing in bad weather is worse than no fishing at all. Get precise wind, wave, and tide maps curated for small boat safety.',
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
      title: 'NoFish.no | Fishing Forecast Map for Small Boats',
      description:
        'Because fishing in bad weather is worse than no fishing at all. Get precise wind, wave, and tide maps curated for small boat safety.',
      url: locale === routing.defaultLocale ? 'https://nofish.no' : `https://nofish.no/${locale}`,
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
      title: 'NoFish.no | Fishing Forecast Map for Small Boats',
      description:
        'Because fishing in bad weather is worse than no fishing at all. Get precise wind, wave, and tide maps curated for small boat safety.',
      images: ['https://nofish.no/marine-weather-security-forecast-og.jpg'],
    },
    alternates: {
      languages: alternates,
    },
  };
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'NoFish.no',
  url: 'https://nofish.no',
  applicationCategory: 'WeatherApplication',
  operatingSystem: 'Web',
  description:
    'Because fishing in bad weather is worse than no fishing at all. Get precise wind, wave, and tide maps curated for small boat safety.',
  genre: 'Fishing',
};

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
