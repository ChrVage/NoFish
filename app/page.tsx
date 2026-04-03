'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
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
      <header style={{ backgroundColor: '#ffffff', color: '#1f2937', padding: '12px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', zIndex: 1100, flexShrink: 0, overflow: 'visible', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', maxWidth: '80rem', margin: '0 auto' }}>
          <Image src="/NoFish.png" alt="NoFish" width={32} height={32} className="rounded-full" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '1rem', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '8px' }}>NoFish</span>
          <span style={{ fontSize: '10px', fontStyle: 'italic', fontWeight: 300, opacity: 0.6, textAlign: 'center', flex: 1, padding: '0 12px' }}>... because fishing in bad weather is worse than no fishing at all</span>
          <div style={{ flexShrink: 0 }}>
            <HeaderMenu />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <Map />
      </div>
    </div>
  );
}
