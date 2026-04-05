'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Header from '@/components/Header';
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
      <Header className="relative z-[1100] shrink-0 overflow-visible">
        <div className="flex items-center max-w-7xl mx-auto">
          <Image src="/NoFish.png" alt="NoFish" width={32} height={32} className="rounded-full shrink-0" />
          <span className="text-base whitespace-nowrap shrink-0 ml-2">NoFish</span>
          <span className="text-[10px] italic font-light opacity-60 text-center flex-1 px-3">... because fishing in bad weather is worse than no fishing at all</span>
          <div className="shrink-0">
            <HeaderMenu />
          </div>
        </div>
      </Header>

      {/* Main content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <Map />
      </div>
    </div>
  );
}
