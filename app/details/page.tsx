import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { insertLookup, ensureTable } from '@/lib/db/lookups';
import { getTimezone } from '@/lib/utils/timezone';
import { haversineDistance, formatDistance } from '@/lib/utils/distance';
import { parseZoomParam } from '@/lib/utils/params';
import ForecastTable from '@/components/ForecastTable';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import { Footer } from '@/components/Footer';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string; sea?: string }>;
}

export default async function DetailsPage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr, zoom: zoomStr, sea: seaStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');
  const validZoom = parseZoomParam(zoomStr);

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  // Pass isSea hint when known — skips 4 ocean API calls for inland points
  const isSea = seaStr === '0' ? false : seaStr === '1' ? true : undefined;

  // Fetch data in parallel directly from lib — no internal HTTP round-trips
  const [locationData, weatherResult] = await Promise.all([
    reverseGeocode(lat, lng),
    getCombinedForecast(lat, lng, isSea !== undefined ? { isSea } : undefined),
  ]);

  const { forecasts, oceanForecastLat, oceanForecastLng, waveForecastSource, tideStationName, tideStationLat, tideStationLng } = weatherResult;
  const isLand = locationData?.isSea === false;
  const hasOceanData = !isLand && oceanForecastLat !== undefined && oceanForecastLng !== undefined;
  const timezone = getTimezone(lat, lng);
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
      <Header>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
          </div>
          <PageNav lat={lat} lng={lng} zoom={validZoom} sea={seaStr} current="details" availablePages={hasOceanData ? undefined : ['details']} />
        </div>
      </Header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Location header */}
          <div className="mb-6 border-b border-gray-200 pb-4">
            {locationData && (
              <>
                <h2 className="text-2xl font-bold text-ocean-900 mb-1">
                  {locationData.name}
                  {locationData.placeDistanceM !== undefined && locationData.placeDistanceM > 100 && (
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      ({formatDistance(locationData.placeDistanceM)} away)
                    </span>
                  )}
                </h2>
                {locationData.municipality && locationData.municipality !== 'Unknown municipality' && (
                  <p className="text-sm text-gray-500">
                    {locationData.municipality}
                  </p>
                )}
              </>
            )}
            <p className="text-sm text-gray-500">
              {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'W'}
              {locationData?.elevation !== undefined && (
                <span className="ml-2 text-gray-400">
                  · {locationData.isSea
                    ? `Depth: ${Math.abs(Math.round(locationData.elevation))} m`
                    : `Elevation: ${Math.round(locationData.elevation)} m`}
                </span>
              )}
            </p>
            {!isLand && (
              <div className="mt-2 space-y-0.5">
                {oceanForecastDistance !== null && oceanForecastLat !== undefined && oceanForecastLng !== undefined && (
                  <p className="text-xs text-gray-400">
                    <span className="font-medium text-ocean-600">{waveForecastSource === 'barentswatch' ? 'Barentswatch Waves' : 'MET Ocean'}</span>
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
            )}
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
            <ForecastTable forecasts={forecasts} timezone={timezone} hideOceanData={isLand} />
          </div>

          <p className="text-xs text-gray-400 mt-6">
            Source:{' '}
            <a
              href={`https://www.yr.no/en/coast/forecast/${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              Yr / MET Norway
            </a>
            {hasOceanData && (
              <>
                {' · '}
                <a
                  href="https://www.barentswatch.no/bolgevarsel/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-600"
                >
                  Barentswatch Wave Forecast
                </a>
              </>
            )}
            {' · '}
            <a
              href={`https://kartverket.no/til-sjos/se-havniva/resultat?latitude=${lat}&longitude=${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              Kartverket – Se havnivå
            </a>
          </p>

          <Footer showColumnRef />

        </div>
      </main>
    </div>
  );
}
