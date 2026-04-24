import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NoFish.no | Fishing Forecast Map for Small Boats",
  description: "Because fishing in bad weather is worse than no fishing at all. Get precise wind, wave, and tide maps curated for small boat safety.",
  referrer: "no-referrer-when-downgrade",
  icons: {
    icon: [
      { url: "/favicon.ico?v=20260424" },
      { url: "/favicon.svg?v=20260424", type: "image/svg+xml" },
      { url: "/favicon-96x96.png?v=20260424", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=20260424", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico?v=20260424"],
  },
  manifest: "/site.webmanifest?v=20260424",
  openGraph: {
    title: "NoFish.no | Fishing Forecast Map for Small Boats",
    description: "Because fishing in bad weather is worse than no fishing at all. Get precise wind, wave, and tide maps curated for small boat safety.",
    url: "https://nofish.no",
    siteName: "NoFish.no",
    images: [
      {
        url: "https://nofish.no/marine-weather-security-forecast-og.jpg",
        width: 1200,
        height: 630,
        alt: "NoFish.no — Fishing Forecast Map for Small Boats",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NoFish.no | Fishing Forecast Map for Small Boats",
    description: "Because fishing in bad weather is worse than no fishing at all. Get precise wind, wave, and tide maps curated for small boat safety.",
    images: ["https://nofish.no/marine-weather-security-forecast-og.jpg"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "NoFish.no",
  "url": "https://nofish.no",
  "applicationCategory": "WeatherApplication",
  "operatingSystem": "Web",
  "description": "Because fishing in bad weather is worse than no fishing at all. Get precise wind, wave, and tide maps curated for small boat safety.",
  "genre": "Fishing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
