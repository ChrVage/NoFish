'use client';

import dynamic from 'next/dynamic';
import HeaderMenu from '@/components/Footer';

// Import Map with SSR disabled (Leaflet requires browser window object)
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-ocean-50">
      <div className="text-center" role="status" aria-label="Loading map">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ocean-500 mx-auto mb-4" aria-hidden="true"></div>
        <p className="text-ocean-700">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-ocean-50">
      {/* Header */}
      <header className="bg-ocean-900 text-white px-6 py-3 shadow-lg z-[1100] shrink-0 overflow-visible relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between pr-2">
          <div className="flex items-center gap-3">
            <span className="text-lg">🎣</span>
            <h1 className="text-base font-normal">
              NoFish <span className="text-[10px] italic font-light">... because fishing in bad weather is worse than no fishing at all</span>
            </h1>
          </div>
          <HeaderMenu />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <Map />
      </div>
    </div>
  );
}
