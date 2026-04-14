import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { getCombinedForecast, solarPosition } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { insertLookup, ensureTable } from '@/lib/db/lookups';
import { getTimezone } from '@/lib/utils/timezone';
import { haversineDistance, formatDistance } from '@/lib/utils/distance';
import { parseZoomParam } from '@/lib/utils/params';
import { enrichForecasts } from '@/lib/utils/enrichForecasts';
import { computeFishingScore } from '@/lib/scoring/fishingScore';
import ForecastTable from '@/components/ForecastTable';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import { Footer } from '@/components/Footer';
import FeedbackBanner from '@/components/FeedbackBanner';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string; sea?: string; ht?: string }>;
}

export default async function DetailsPage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr, zoom: zoomStr, sea: seaStr, ht: htStr } = await searchParams;
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

  const { forecasts: rawForecasts, oceanForecastLat, oceanForecastLng, waveForecastSource, tideStationName, tideStationLat, tideStationLng } = weatherResult;
  const forecasts = enrichForecasts(rawForecasts);
  const isLand = locationData?.isSea === false;
  const hasOceanData = !isLand && oceanForecastLat !== undefined && oceanForecastLng !== undefined;
  const timezone = getTimezone(lat, lng);
  const depth = locationData?.isSea && locationData.elevation !== undefined
    ? Math.abs(locationData.elevation)
    : undefined;
  const oceanForecastDistance = oceanForecastLat !== undefined && oceanForecastLng !== undefined
    ? haversineDistance(lat, lng, oceanForecastLat, oceanForecastLng)
    : null;
  const tideStationDistance = tideStationLat !== undefined && tideStationLng !== undefined
    ? haversineDistance(lat, lng, tideStationLat, tideStationLng)
    : null;

  // ── Civil twilight end warning (sea locations only) ──────────────────────
  // Find today's civil twilight end (sun crosses -6° going down in the evening)
  const timeFmtHHMM = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone });
  let civilTwilightEnd: Date | null = null;
  let isDark = false;
  let topDangers: { time: string; reasons: string[] }[] = [];
  if (!isLand) {
    const now = new Date();
    const currentElev = solarPosition(now, lat, lng).elevation;
    isDark = currentElev < -6;

    // Search for the evening civil twilight end: scan from local noon onward
    // Start of local day in the forecast timezone
    const dayStart = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replace(/-/g, '/') + ' 12:00:00 UTC');
    // Approximate local noon in UTC (offset by ~lng/15 hours; good enough for scanning)
    const localNoonApprox = new Date(dayStart.getTime() - (lng / 15) * 3600000);
    // Scan from noon to midnight in 1-minute steps
    const scanEnd = new Date(localNoonApprox.getTime() + 12 * 3600000);
    let prevElev = solarPosition(localNoonApprox, lat, lng).elevation;
    for (let t = new Date(localNoonApprox.getTime() + 60000); t <= scanEnd; t = new Date(t.getTime() + 60000)) {
      const elev = solarPosition(t, lat, lng).elevation;
      // Civil twilight ends when elevation crosses -6° going downward
      if (prevElev >= -6 && elev < -6) {
        // Binary search for exact crossing
        let lo = new Date(t.getTime() - 60000);
        let hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = new Date((lo.getTime() + hi.getTime()) / 2);
          if (solarPosition(mid, lat, lng).elevation >= -6) {lo = mid;}
          else {hi = mid;}
        }
        civilTwilightEnd = new Date((lo.getTime() + hi.getTime()) / 2);
        break;
      }
      prevElev = elev;
    }

    // Collect all danger hours before civil twilight end, pick worst 1–2
    if (civilTwilightEnd && !isDark) {
      const cutoffMs = civilTwilightEnd.getTime();
      const allDangers: { time: string; reasons: string[]; count: number }[] = [];
      for (const f of forecasts) {
        const fMs = new Date(f.time).getTime();
        if (fMs >= cutoffMs) {break;}
        const { reasons } = computeFishingScore(f, depth);
        const dangerReasons = reasons.filter(r => r.tone === 'danger').map(r => r.text);
        if (dangerReasons.length > 0) {
          allDangers.push({ time: f.time, reasons: dangerReasons, count: dangerReasons.length });
        }
      }
      // Pick first danger chronologically, then only add a later one if it's more serious
      const chronological = allDangers.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      topDangers = [];
      if (chronological.length > 0) {
        topDangers.push(chronological[0]);
        // Only add a second entry if it has strictly more danger reasons
        for (let i = 1; i < chronological.length; i++) {
          if (chronological[i].count > chronological[0].count) {
            topDangers.push(chronological[i]);
            break;
          }
        }
      }
    }
  }

  // Capture request headers now — not available inside after()
  const reqHeaders = await headers();
  const forwarded = reqHeaders.get('x-forwarded-for');
  const ipAddress = (forwarded ? forwarded.split(',')[0].trim() : reqHeaders.get('x-real-ip')) ?? undefined;
  const userAgent = reqHeaders.get('user-agent') ?? undefined;
  // Vercel injects these automatically on every request
  const geoCountry = reqHeaders.get('x-vercel-ip-country') ?? undefined;
  const geoRegion  = reqHeaders.get('x-vercel-ip-country-region') ?? undefined;
  const geoCityRaw = reqHeaders.get('x-vercel-ip-city') ?? undefined;
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
          <PageNav lat={lat} lng={lng} zoom={validZoom} sea={seaStr} current="details" highlightTimes={htStr} />
        </div>
      </Header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg" style={{ padding: '2rem 1.5rem' }}>
          {/* Location header */}
          <div className="mb-6">
            {locationData && (
              <h2 className="text-2xl font-bold text-ocean-900 mb-1">
                {locationData.name}
                {locationData.municipality && locationData.municipality !== 'Unknown municipality' && locationData.municipality !== locationData.name && (
                  <span className="text-lg font-normal text-gray-500">, {locationData.municipality}</span>
                )}
              </h2>
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

            {/* Civil twilight & safety warnings */}
            {!isLand && (isDark || civilTwilightEnd) && (
              <p className="mt-2 text-sm text-amber-800">
                {isDark ? (
                  <span className="font-semibold">Currently: Dark</span>
                ) : civilTwilightEnd && (() => {
                  const twilightMs = civilTwilightEnd.getTime();
                  const firstForecastMs = forecasts.length > 0 ? new Date(forecasts[0].time).getTime() : 0;
                  type Entry = { ms: number; kind: 'danger'; time: string; reasons: string[] } | { ms: number; kind: 'twilight' };
                  const entries: Entry[] = [
                    ...topDangers.map(d => ({ ms: new Date(d.time).getTime(), kind: 'danger' as const, time: d.time, reasons: d.reasons })),
                    { ms: twilightMs, kind: 'twilight' as const },
                  ].sort((a, b) => a.ms - b.ms);

                  return entries.map((entry, i) => {
                    if (entry.kind === 'twilight') {
                      return (
                        <span key="twilight">
                          {i > 0 && ' · '}
                          <span style={{ fontWeight: 700 }}>{timeFmtHHMM.format(civilTwilightEnd)}:</span>
                          {' Civil daylight ends'}
                        </span>
                      );
                    }
                    const isCurrent = entry.ms <= firstForecastMs;
                    const cleaned = entry.reasons.map(r => r.replace(/⚠️\s*/g, '').trim());
                    return (
                      <span key={i} className="text-red-800">
                        {i > 0 && ' · '}
                        {'⚠️ '}
                        <span style={{ fontWeight: 700 }}>
                          {isCurrent ? 'Now:' : `${timeFmtHHMM.format(new Date(entry.time))}:`}
                        </span>
                        {' '}
                        {cleaned.join(', ')}
                      </span>
                    );
                  });
                })()}
              </p>
            )}
          </div>

          {/* Forecast table */}
          <div className="mb-6">
            <ForecastTable forecasts={forecasts} timezone={timezone} hideOceanData={isLand} highlightTimes={htStr ? htStr.split(',') : undefined} lat={lat} lng={lng} locationName={locationData?.name} />
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

      <FeedbackBanner />
    </div>
  );
}
