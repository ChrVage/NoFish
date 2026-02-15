'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { reverseGeocode, type GeocodingResult } from '@/lib/api/geocoding';
import { getCombinedForecast } from '@/lib/api/weather';
import type { HourlyForecast } from '@/types/weather';
import ForecastTable from '@/components/ForecastTable';

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');

  const [locationData, setLocationData] = useState<GeocodingResult | null>(null);
  const [forecastData, setForecastData] = useState<HourlyForecast[] | null>(null);
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
        const [geocodingResult, forecasts] = await Promise.all([
          reverseGeocode(lat, lng),
          getCombinedForecast(lat, lng),
        ]);

        setLocationData(geocodingResult);
        setForecastData(forecasts);
      } catch (err) {
        console.error('❌ Error fetching location data:', err);
        setError('Failed to load forecast data. Please try again.');
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
              Loading forecast...
            </h2>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg p-8">
            {/* Location header */}
            <div className="mb-6 border-b border-gray-200 pb-4">
              {locationData && (
                <h2 className="text-2xl font-bold text-ocean-900 mb-2">
                  {locationData.municipality}
                  {locationData.county && `, ${locationData.county}`}
                </h2>
              )}
              <p className="text-sm text-gray-500">
                {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'}, {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'W'}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Forecast data */}
            {forecastData && (
              <div className="mb-6">
                <ForecastTable forecasts={forecastData} />
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
