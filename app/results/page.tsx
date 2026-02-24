import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { insertLookup, ensureTable } from '@/lib/db/lookups';
import ForecastTable from '@/components/ForecastTable';
import BackButton from './BackButton';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string }>;
}

export default async function ResultsPage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  // Fetch data in parallel directly from lib — no internal HTTP round-trips
  const [locationData, weatherResult] = await Promise.all([
    reverseGeocode(lat, lng),
    getCombinedForecast(lat, lng),
  ]);

  const { forecasts, metadata } = weatherResult;

  // Capture request headers now — not available inside after()
  const reqHeaders = await headers();
  const forwarded = reqHeaders.get('x-forwarded-for');
  const ipAddress = (forwarded ? forwarded.split(',')[0].trim() : reqHeaders.get('x-real-ip')) ?? undefined;
  const userAgent = reqHeaders.get('user-agent') ?? undefined;
  // Vercel injects these automatically on every request
  const geoCountry = reqHeaders.get('x-vercel-ip-country') || undefined;
  const geoRegion  = reqHeaders.get('x-vercel-ip-country-region') || undefined;
  const geoCityRaw = reqHeaders.get('x-vercel-ip-city') || undefined;
  const geoCity    = geoCityRaw
    ? (() => { try { return decodeURIComponent(geoCityRaw); } catch { return geoCityRaw; } })()
    : undefined;

  // Log the lookup after the response is sent — skipped in local development
  if (process.env.NODE_ENV === 'production') {
    after(async () => {
      try {
        await ensureTable();
        await insertLookup({
          lat,
          lon: lng,
          locationName: locationData?.name ?? undefined,
          municipality: locationData?.municipality ?? undefined,
          county: locationData?.county ?? undefined,
          ipAddress,
          userAgent,
          geoCountry,
          geoRegion,
          geoCity,
        });
      } catch (err) {
        console.warn('Failed to log lookup:', err);
      }
    });
  }

  return (
    <div className="min-h-screen bg-ocean-50">
      {/* Header */}
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
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
              {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'W'}
            </p>
          </div>

          {/* Tide data notice */}
          {metadata.tideDataSource === 'sample' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 text-lg">ℹ️</span>
                <div>
                  <p className="text-sm font-medium text-yellow-900">Using Simulated Tide Data</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    {metadata.tideDataMessage ?? 'Real tide data temporarily unavailable'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Forecast table */}
          <div className="mb-6">
            <ForecastTable forecasts={forecasts} />
          </div>

          {/* Action button */}
          <div className="flex gap-4">
            <BackButton
              label="Select different location"
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
