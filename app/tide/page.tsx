import { notFound } from 'next/navigation';
import { getTidePageData } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { getTimezone, getTimezoneLabel } from '@/lib/utils/timezone';
import { haversineDistance, formatDistance } from '@/lib/utils/distance';
import { parseZoomParam } from '@/lib/utils/params';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import Footer from '@/components/Footer';
import type { TidePrediction } from '@/types/weather';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string }>;
}

export default async function TidePage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr, zoom: zoomStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');
  const validZoom = parseZoomParam(zoomStr);

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  const [locationData, tidePageData] = await Promise.all([
    reverseGeocode(lat, lng),
    getTidePageData(lat, lng),
  ]);

  const timezone = getTimezone(lat, lng);
  const timezoneLabel = getTimezoneLabel(timezone);
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
  const events = tidePageData?.events ?? [];

  // Match each event to the best forecast value from the 10-min forecast data
  function findForecast(eventTime: string, flag: 'high' | 'low', predictions: TidePrediction[]): number | null {
    if (predictions.length === 0) return null;
    const eventMs = new Date(eventTime).getTime();
    const MAX_GAP_MS = 15 * 60 * 1000; // must be within 15 min

    // Find the closest forecast point
    let bestIdx = 0;
    let bestDiff = Math.abs(new Date(predictions[0].time).getTime() - eventMs);
    for (let i = 1; i < predictions.length; i++) {
      const diff = Math.abs(new Date(predictions[i].time).getTime() - eventMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    // No forecast available near this event time
    if (bestDiff > MAX_GAP_MS) return null;

    // Get the two closest (the best and its neighbor closer to the event)
    const bestMs = new Date(predictions[bestIdx].time).getTime();
    let neighborIdx: number;
    if (bestMs <= eventMs && bestIdx + 1 < predictions.length) {
      neighborIdx = bestIdx + 1;
    } else if (bestMs > eventMs && bestIdx - 1 >= 0) {
      neighborIdx = bestIdx - 1;
    } else {
      return predictions[bestIdx].value;
    }

    const a = predictions[bestIdx].value;
    const b = predictions[neighborIdx].value;
    // For high tide pick the higher value; for low tide pick the lower value
    return flag === 'high' ? Math.max(a, b) : Math.min(a, b);
  }

  const predictions = tidePageData?.forecasts ?? [];

  // Only show events up to the last available forecast time
  const lastForecastMs = predictions.length
    ? new Date(predictions[predictions.length - 1].time).getTime()
    : null;
  const visibleEvents = lastForecastMs != null
    ? events.filter((e) => new Date(e.time).getTime() <= lastForecastMs)
    : events;

  const eventPredictions = visibleEvents.map((e) => findForecast(e.time, e.flag, predictions));

  // Compute extremes for forecast column
  const highForecasts = visibleEvents
    .map((e, i) => (e.flag === 'high' ? eventPredictions[i] : null))
    .filter((v): v is number => v != null);
  const lowForecasts = visibleEvents
    .map((e, i) => (e.flag === 'low' ? eventPredictions[i] : null))
    .filter((v): v is number => v != null);
  const maxHighForecast = highForecasts.length ? Math.max(...highForecasts) : null;
  const minLowForecast  = lowForecasts.length  ? Math.min(...lowForecasts)  : null;

  return (
    <div className="min-h-screen bg-ocean-50">
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton label="← 🎣 NoFish" className="text-sm font-normal text-white hover:text-ocean-200 transition-colors" />
          </div>
          <PageNav lat={lat} lng={lng} zoom={validZoom} current="tide" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
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
            {(() => {
              const level = tidePageData?.currentLevel;
              const levelTime = tidePageData?.currentLevelTime;
              if (level == null || !levelTime) return null;
              const hhmm = new Intl.DateTimeFormat('en-GB', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
              }).format(new Date(levelTime));
              return (
                <p className="text-sm text-gray-600 mt-1">
                  Current level: {level.toFixed(1)} cm{' '}
                  <span className="text-gray-400">({hhmm})</span>
                </p>
              );
            })()}
            <p className="text-xs text-gray-400 mt-1">
              Times shown in local time · {timezoneLabel}
            </p>
            {tidePageData?.stationName && (() => {
              const hasCoords = tidePageData.stationLat != null && tidePageData.stationLng != null;
              return (
                <p className="text-xs text-gray-400 mt-1">
                  Station: {tidePageData.stationName}
                  {hasCoords && (
                    <> · {formatDistance(haversineDistance(lat, lng, tidePageData.stationLat!, tidePageData.stationLng!))} from selected location</>
                  )}
                </p>
              );
            })()}
          </div>

          {visibleEvents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tide data available for this location.</p>
          ) : (
            <table className="text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                  <th className="pb-2 pr-8">Time</th>
                  <th className="pb-2 pr-8 text-right">Tide forecast</th>
                  <th className="pb-2 pl-6 text-right">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleEvents.map((event, i) => {
                  const pred = eventPredictions[i];
                  const isExtremeForecast = pred != null
                    && ((event.flag === 'high' && pred === maxHighForecast)
                      || (event.flag === 'low' && pred === minLowForecast));
                  return (
                    <tr
                      key={i}
                      className={
                        event.flag === 'high'
                          ? 'text-blue-700'
                          : 'text-teal-700'
                      }
                    >
                      <td className="py-2 pr-8 tabular-nums">
                        {timeFormatter.format(new Date(event.time))}
                      </td>
                      <td className="py-2 pr-8 text-right tabular-nums whitespace-nowrap"
                          style={isExtremeForecast ? { fontWeight: 700 } : undefined}>
                        {pred != null ? `${pred.toFixed(1)} cm` : '—'}
                      </td>
                      <td className="py-2 text-right pl-6 font-semibold">
                        {event.flag === 'high' ? 'High' : 'Low'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <p className="text-xs text-gray-400 mt-6">
            Source:{' '}
            <a
              href={`https://kartverket.no/til-sjos/se-havniva/resultat?latitude=${lat}&longitude=${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              Kartverket – Se havnivå
            </a>
          </p>

        </div>
      </main>

      <Footer />
    </div>
  );
}
