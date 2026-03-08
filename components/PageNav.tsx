import Link from 'next/link';

interface PageNavProps {
  lat: number;
  lng: number;
  zoom?: number;
  current: 'score' | 'details' | 'tide';
}

const pages = [
  {
    key: 'score',
    label: 'Score',
    href: (lat: number, lng: number, zoom?: number) => `/score?lat=${lat}&lng=${lng}${zoom !== undefined ? `&zoom=${zoom}` : ''}`,
    className: 'bg-gray-100 hover:bg-gray-200 text-green-700',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: 'details',
    label: 'Details',
    href: (lat: number, lng: number, zoom?: number) => `/details?lat=${lat}&lng=${lng}${zoom !== undefined ? `&zoom=${zoom}` : ''}`,
    className: 'bg-ocean-500 hover:bg-ocean-700 text-white',
    icon: (
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
      </svg>
    ),
  },
  {
    key: 'tide',
    label: 'Tides',
    href: (lat: number, lng: number, zoom?: number) => `/tide?lat=${lat}&lng=${lng}${zoom !== undefined ? `&zoom=${zoom}` : ''}`,
    className: 'bg-blue-600 hover:bg-blue-800 text-white',
    icon: (
      <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
] as const;

export default function PageNav({ lat, lng, zoom, current }: PageNavProps) {
  return (
    <div className="flex gap-2">
      {pages
        .filter((p) => p.key !== current)
        .map((p) => (
          <Link
            key={p.key}
            href={p.href(lat, lng, zoom)}
            className={`flex flex-col items-center gap-1 font-medium py-2 px-3 rounded-lg transition-colors ${p.className}`}
          >
            {p.icon}
            <span className="text-xs">{p.label}</span>
          </Link>
        ))}
    </div>
  );
}
