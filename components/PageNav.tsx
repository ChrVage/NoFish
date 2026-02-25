import Link from 'next/link';

interface PageNavProps {
  lat: number;
  lng: number;
  current: 'score' | 'details' | 'tide';
}

const pages = [
  {
    key: 'score',
    label: 'Score',
    href: (lat: number, lng: number) => `/score?lat=${lat}&lng=${lng}`,
    icon: (
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: 'details',
    label: 'Details',
    href: (lat: number, lng: number) => `/details?lat=${lat}&lng=${lng}`,
    icon: (
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
      </svg>
    ),
  },
  {
    key: 'tide',
    label: 'Tides',
    href: (lat: number, lng: number) => `/tide?lat=${lat}&lng=${lng}`,
    icon: (
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
] as const;

export default function PageNav({ lat, lng, current }: PageNavProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {pages
        .filter((p) => p.key !== current)
        .map((p) => (
          <Link
            key={p.key}
            href={p.href(lat, lng)}
            className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
          >
            {p.icon}
            {p.label}
          </Link>
        ))}
    </div>
  );
}
