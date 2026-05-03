'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { buildLocationUrl } from '@/lib/utils/params';
import type { BoatSizePreset, FishTarget, FishingMethod } from '@/lib/utils/tuning';

interface PageNavProps {
  lat: number;
  lng: number;
  zoom?: number;
  sea?: string;
  boat?: BoatSizePreset;
  fish?: FishTarget;
  method?: FishingMethod;
  current: 'score' | 'details' | 'tide';
  /** When set, only pages whose key is in this array are shown. */
  availablePages?: ('score' | 'details' | 'tide')[];
}

const pageKeys = ['score', 'details', 'tide'] as const;

const pageIcons = {
  score: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  details: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
    </svg>
  ),
  tide: (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
} as const;

export default function PageNav({ lat, lng, zoom, sea, boat, fish, method, current, availablePages }: PageNavProps) {
  const t = useTranslations('nav');
  const locale = useLocale();

  return (
    <nav aria-label={t('ariaLabel')} style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden' }}>
      {pageKeys
        .filter((key) => !availablePages || availablePages.includes(key))
        .map((key, i, arr) => {
          const isCurrent = key === current;
          const label = t(key);
          const href = buildLocationUrl(key as 'score' | 'details' | 'tide', { lat, lng, zoom, sea, boat, fish, method }, locale);
          const baseStyle: React.CSSProperties = {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 0.875rem',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRight: i < arr.length - 1 ? '2px solid white' : 'none',
            minHeight: '44px',
          };
          const currentStyle: React.CSSProperties = {
            ...baseStyle,
            backgroundColor: '#00695c',
            color: 'white',
            cursor: 'default',
          };
          const linkStyle: React.CSSProperties = {
            ...baseStyle,
            backgroundColor: '#f3f4f6',
            color: '#1f2937',
          };
          return isCurrent ? (
            <span key={key} style={currentStyle} aria-current="page">
              {pageIcons[key]}
              <span>{label}</span>
            </span>
          ) : (
            <Link key={key} href={href} style={linkStyle}>
              {pageIcons[key]}
              <span>{label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
