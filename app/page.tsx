'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { reverseGeocode, type GeocodingResult } from '@/lib/api/geocoding';
import { validateWeatherLocation, type WeatherValidationResult } from '@/lib/api/weather';

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

interface LocationData {
  lat: number;
  lng: number;
  geocoding: GeocodingResult | null;
  weather: WeatherValidationResult | null;
}

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocationSelect = async (lat: number, lng: number) => {
    setIsAnalyzing(true);
    setError(null);
    setSelectedLocation(null);

    try {
      // Fetch geocoding and weather validation in parallel
      const [geocodingResult, weatherResult] = await Promise.all([
        reverseGeocode(lat, lng),
        validateWeatherLocation(lat, lng),
      ]);

      setSelectedLocation({
        lat,
        lng,
        geocoding: geocodingResult,
        weather: weatherResult,
      });

      // Check if location is valid
      if (!weatherResult?.available) {
        setError('Weather data not available for this location. Try selecting a point on the coast.');
      }
    } catch (err) {
      console.error('Location validation error:', err);
      setError('Failed to validate location. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
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
        {(selectedLocation || isAnalyzing) && (
          <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-2xl p-6 max-w-sm z-[1000]">
            {isAnalyzing ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ocean-500"></div>
                <div>
                  <h3 className="font-semibold text-ocean-700">Validating location...</h3>
                  <p className="text-sm text-gray-600">
                    Checking weather data availability
                  </p>
                </div>
              </div>
            ) : selectedLocation ? (
              <div>
                {/* Location name and municipality */}
                {selectedLocation.geocoding ? (
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-ocean-900">
                      {selectedLocation.geocoding.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedLocation.geocoding.municipality}
                      {selectedLocation.geocoding.county && `, ${selectedLocation.geocoding.county}`}
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-ocean-900">Unknown location</h3>
                  </div>
                )}

                {/* Coordinates */}
                <div className="mb-4 text-xs text-gray-500">
                  {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lng.toFixed(4)}°E
                </div>

                {/* Weather validation status */}
                {selectedLocation.weather?.available ? (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-sm">Weather data available</span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-sm">No weather data</span>
                    </div>
                    <p className="text-xs text-red-600 mt-1">
                      {selectedLocation.weather?.error || 'Try selecting a coastal location'}
                    </p>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">{error}</p>
                  </div>
                )}

                {/* Action button */}
                <button
                  className={`w-full font-medium py-2 px-4 rounded-lg transition-colors ${
                    selectedLocation.weather?.available
                      ? 'bg-ocean-500 hover:bg-ocean-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    if (selectedLocation.weather?.available) {
                      // TODO: Navigate to results page or show detailed analysis
                      alert('Fishing forecast coming soon!');
                    }
                  }}
                  disabled={!selectedLocation.weather?.available}
                >
                  {selectedLocation.weather?.available
                    ? 'View fishing forecast'
                    : 'Select valid location'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
