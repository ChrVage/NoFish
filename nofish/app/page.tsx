'use client';

import { useState } from 'react';
import Map from '@/components/Map';

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    setIsAnalyzing(true);

    // TODO: Fetch weather, tides, and calculate fishing score
    // For now, just simulate a delay
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 1000);
  };

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
        <Map onLocationSelect={handleLocationSelect} />

        {/* Loading/Results panel */}
        {selectedLocation && (
          <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-2xl p-6 max-w-sm z-[1000]">
            {isAnalyzing ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean-500"></div>
                <div>
                  <h3 className="font-semibold text-ocean-700">Analyzing conditions...</h3>
                  <p className="text-sm text-gray-600">
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold text-ocean-700 mb-2">Location selected</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Coordinates: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                </p>
                <button
                  className="w-full bg-ocean-500 hover:bg-ocean-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  onClick={() => {
                    // TODO: Navigate to results page or show detailed analysis
                    alert('Results view coming soon!');
                  }}
                >
                  View fishing forecast
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
