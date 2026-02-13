'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { reverseGeocode, type GeocodingResult } from '@/lib/api/geocoding';
import { validateWeatherLocation, type WeatherValidationResult } from '@/lib/api/weather';

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');

  const [locationData, setLocationData] = useState<{
    geocoding: GeocodingResult | null;
    weather: WeatherValidationResult | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!lat || !lng) {
        setError('Invalid location coordinates');
        setIsLoading(false);
        return;
      }

      try {
        console.log('📡 Fetching data for:', lat, lng);
        const [geocodingResult, weatherResult] = await Promise.all([
          reverseGeocode(lat, lng),
          validateWeatherLocation(lat, lng),
        ]);

        setLocationData({
          geocoding: geocodingResult,
          weather: weatherResult,
        });

        if (!weatherResult?.available) {
          setError('Weather data not available for this location. Try selecting a point on the coast.');
        }
      } catch (err) {
        console.error('❌ Error fetching location data:', err);
        setError('Failed to load location data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [lat, lng]);

  return (
    <div className="min-h-screen bg-ocean-50">
      {/* Header */}
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-ocean-50 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <span className="text-3xl">🎣</span>
            <h1 className="text-2xl font-bold">NoFish</h1>
          </div>
          <p className="text-ocean-50 text-sm hidden sm:block">
            Fishing Conditions Analysis
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ocean-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-ocean-700 mb-2">
              Analyzing fishing conditions...
            </h2>
            <p className="text-gray-600">
              Checking weather, tides, and sunlight data
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8">
            {/* Location header */}
            <div className="mb-6 border-b border-gray-200 pb-4">
              <h2 className="text-2xl font-bold text-ocean-900 mb-2">
                {locationData?.geocoding?.name || 'Unknown location'}
              </h2>
              {locationData?.geocoding && (
                <p className="text-gray-600 mb-1">
                  {locationData.geocoding.municipality}
                  {locationData.geocoding.county && `, ${locationData.geocoding.county}`}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'}, {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'W'}
              </p>
            </div>

            {/* Weather validation status */}
            {locationData?.weather?.available ? (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium text-lg">Weather data available</span>
                </div>
                <p className="text-sm text-green-600">
                  Ready to analyze fishing conditions for this location
                </p>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium text-lg">No weather data available</span>
                </div>
                <p className="text-sm text-red-600">
                  {locationData?.weather?.error || error || 'Try selecting a coastal location'}
                </p>
              </div>
            )}

            {/* Error message */}
            {error && !locationData?.weather && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">{error}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => router.push('/')}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Select different location
              </button>
              {locationData?.weather?.available && (
                <button
                  className="flex-1 bg-ocean-500 hover:bg-ocean-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                  disabled
                  title="Detailed forecast feature coming soon"
                >
                  View detailed forecast
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-ocean-50">
      {/* Header */}
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <span className="text-3xl">🎣</span>
          <h1 className="text-2xl font-bold">NoFish</h1>
        </div>
      </header>

      {/* Loading content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ocean-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-ocean-700 mb-2">
            Loading location data...
          </h2>
          <p className="text-gray-600">
            Please wait
          </p>
        </div>
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResultsContent />
    </Suspense>
  );
}
