'use client';

import dynamic from 'next/dynamic';

// Import Map with SSR disabled (Leaflet requires browser window object)
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-ocean-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ocean-500 mx-auto mb-4"></div>
        <p className="text-ocean-700">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-ocean-50">
      {/* Header */}
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎣</span>
            <h1 className="text-2xl font-bold">NoFish</h1>
          </div>
          <p className="text-ocean-50 text-sm hidden sm:block">
            When NOT to go fishing on the Norwegian coast
          </p>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 relative">
        <Map />
      </div>
    </div>
  );
}
