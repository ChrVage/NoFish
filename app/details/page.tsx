import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { insertLookup, ensureTable } from '@/lib/db/lookups';
import { getTimezone, getTimezoneLabel } from '@/lib/utils/timezone';
import { haversineDistance, formatDistance } from '@/lib/utils/distance';
import { parseZoomParam } from '@/lib/utils/params';
import ForecastTable from '@/components/ForecastTable';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import Footer from '@/components/Footer';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string }>;
}

export default async function DetailsPage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr, zoom: zoomStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');
  const validZoom = parseZoomParam(zoomStr);

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  // Fetch data in parallel directly from lib — no internal HTTP round-trips
  const [locationData, weatherResult] = await Promise.all([
    reverseGeocode(lat, lng),
    getCombinedForecast(lat, lng),
  ]);

  const { forecasts, oceanForecastLat, oceanForecastLng, tideStationName, tideStationLat, tideStationLng } = weatherResult;
  const hasOceanData = oceanForecastLat !== undefined && oceanForecastLng !== undefined;
  const timezone = getTimezone(lat, lng);
  const timezoneLabel = getTimezoneLabel(timezone);
  const oceanForecastDistance = oceanForecastLat !== undefined && oceanForecastLng !== undefined
    ? haversineDistance(lat, lng, oceanForecastLat, oceanForecastLng)
    : null;
  const tideStationDistance = tideStationLat !== undefined && tideStationLng !== undefined
    ? haversineDistance(lat, lng, tideStationLat, tideStationLng)
    : null;

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
            <BackButton label="← 🎣 NoFish" className="text-sm font-normal text-white hover:text-ocean-200 transition-colors" />
          </div>
          <PageNav lat={lat} lng={lng} zoom={validZoom} current="details" availablePages={hasOceanData ? undefined : ['details']} />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Location header */}
          <div className="mb-6 border-b border-gray-200 pb-4">
            {locationData && (
              <>
                <h2 className="text-2xl font-bold text-ocean-900 mb-1">
                  {locationData.name !== locationData.municipality
                    ? `${locationData.name}, ${locationData.municipality}`
                    : locationData.municipality}
                  {locationData.county && `, ${locationData.county}`}
                </h2>
              </>
            )}
            <p className="text-sm text-gray-500">
              {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'W'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Times shown in local time · {timezoneLabel}
            </p>
            <div className="mt-2 space-y-0.5">
              {oceanForecastDistance !== null && oceanForecastLat !== undefined && oceanForecastLng !== undefined && (
                <p className="text-xs text-gray-400">
                  <span className="font-medium text-ocean-600">MET Ocean</span>
                  {' '}· forecast grid point {formatDistance(oceanForecastDistance)} away
                  {' '}({oceanForecastLat.toFixed(4)}°N, {oceanForecastLng.toFixed(4)}°E)
                </p>
              )}
              {tideStationDistance !== null && tideStationLat !== undefined && tideStationLng !== undefined && (
                <p className="text-xs text-gray-400">
                  <span className="font-medium text-purple-600">Kartverket Tides</span>
                  {' '}· nearest station {formatDistance(tideStationDistance)} away
                  {tideStationName ? ` (${tideStationName})` : ''}
                  {' '}({tideStationLat.toFixed(4)}°N, {tideStationLng.toFixed(4)}°E)
                </p>
              )}
            </div>
          </div>

          {/* Forecast table */}
          <div className="mb-6">
            {/* Accuracy legend */}
            <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
              <span className="text-xs font-medium text-gray-400 tracking-wide mr-1">Confidence:</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border" style={{ backgroundColor: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>High</span>
              <span className="text-[10px] text-gray-300 select-none">›</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border" style={{ backgroundColor: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}>Medium</span>
              <span className="text-[10px] text-gray-300 select-none">›</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border" style={{ backgroundColor: '#fed7aa', color: '#9a3412', borderColor: '#fb923c' }}>Low</span>
            </div>
            <ForecastTable forecasts={forecasts} timezone={timezone} />
          </div>


        </div>
      </main>

      <Footer />
    </div>
  );
}
