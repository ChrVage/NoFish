import Link from 'next/link';
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

const pages = [
  {
    key: 'score',
    label: 'Score',
    href: (lat: number, lng: number, zoom?: number, sea?: string, boat?: BoatSizePreset, fish?: FishTarget, method?: FishingMethod) => buildLocationUrl('score', { lat, lng, zoom, sea, boat, fish, method }),
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: 'details',
    label: 'Details',
    href: (lat: number, lng: number, zoom?: number, sea?: string, boat?: BoatSizePreset, fish?: FishTarget, method?: FishingMethod) => buildLocationUrl('details', { lat, lng, zoom, sea, boat, fish, method }),
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
      </svg>
    ),
  },
  {
    key: 'tide',
    label: 'Tides',
    href: (lat: number, lng: number, zoom?: number, sea?: string, boat?: BoatSizePreset, fish?: FishTarget, method?: FishingMethod) => buildLocationUrl('tide', { lat, lng, zoom, sea, boat, fish, method }),
    icon: (
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
] as const;

export default function PageNav({ lat, lng, zoom, sea, boat, fish, method, current, availablePages }: PageNavProps) {
  return (
    <nav aria-label="Page navigation" style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden' }}>
      {pages
        .filter((p) => !availablePages || availablePages.includes(p.key))
        .map((p, i, arr) => {
          const isCurrent = p.key === current;
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
            backgroundColor: '#9ca3af',
            color: 'white',
            cursor: 'default',
          };
          const linkStyle: React.CSSProperties = {
            ...baseStyle,
            backgroundColor: '#f3f4f6',
            color: '#1f2937',
          };
          return isCurrent ? (
            <span key={p.key} style={currentStyle} aria-current="page">
              {p.icon}
              <span>{p.label}</span>
            </span>
          ) : (
            <Link
              key={p.key}
              href={p.href(lat, lng, zoom, sea, boat, fish, method)}
              style={linkStyle}
            >
              {p.icon}
              <span>{p.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
