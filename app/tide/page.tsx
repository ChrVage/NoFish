import { notFound } from 'next/navigation';
import { getTidePageData } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { getTimezone } from '@/lib/utils/timezone';
import { haversineDistance, formatDistance } from '@/lib/utils/distance';
import { parseZoomParam } from '@/lib/utils/params';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import { Footer } from '@/components/Footer';
import FeedbackButton from '@/components/FeedbackButton';
import FeedbackBanner from '@/components/FeedbackBanner';
import type { TidePrediction } from '@/types/weather';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string; sea?: string }>;
}

export default async function TidePage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr, zoom: zoomStr, sea: seaStr } = await searchParams;
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
    if (predictions.length === 0) {return null;}
    const eventMs = new Date(eventTime).getTime();
    const MAX_GAP_MS = 15 * 60 * 1000; // must be within 15 min

    let bestIdx = 0;
    let bestDiff = Math.abs(new Date(predictions[0].time).getTime() - eventMs);
    for (let i = 1; i < predictions.length; i++) {
      const diff = Math.abs(new Date(predictions[i].time).getTime() - eventMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestDiff > MAX_GAP_MS) {return null;}

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
    return flag === 'high' ? Math.max(a, b) : Math.min(a, b);
  }

  const predictions = tidePageData?.forecasts ?? [];

  // eslint-disable-next-line react-hooks/purity -- server component renders once
  const nowMs = Date.now();
  const futureEvents = events.filter((e) => new Date(e.time).getTime() > nowMs);

  // Only show events that have a matching forecast value
  const paired = futureEvents
    .map((e) => ({ event: e, pred: findForecast(e.time, e.flag, predictions) }))
    .filter((p): p is { event: typeof p.event; pred: number } => p.pred != null);

  const visibleEvents = paired.map((p) => p.event);
  const eventPredictions = paired.map((p) => p.pred);

  // Compute extremes for highlighting
  const highForecasts = visibleEvents
    .map((e, i) => (e.flag === 'high' ? eventPredictions[i] : null))
    .filter((v): v is number => v != null);
  const lowForecasts = visibleEvents
    .map((e, i) => (e.flag === 'low' ? eventPredictions[i] : null))
    .filter((v): v is number => v != null);
  const maxHigh = highForecasts.length ? Math.max(...highForecasts) : null;
  const minLow  = lowForecasts.length  ? Math.min(...lowForecasts)  : null;

  return (
    <div className="min-h-screen bg-ocean-50">
      <Header>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
          </div>
          <PageNav lat={lat} lng={lng} zoom={validZoom} sea={seaStr} current="tide" availablePages={locationData?.isSea === false ? ['details'] : undefined} />
        </div>
      </Header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg" style={{ padding: '2rem 1.5rem' }}>
          <div className="mb-6 border-b border-gray-200 pb-4">
            {locationData && (
              <>
                <h2 className="text-2xl font-bold text-ocean-900 mb-1">
                  Forecast for: {locationData.name}
                  {locationData.municipality && locationData.municipality !== 'Unknown municipality' && locationData.municipality !== locationData.name && (
                    <span className="text-lg font-normal text-gray-500">, {locationData.municipality}</span>
                  )}
                </h2>
              </>
            )}
            <p className="text-sm text-gray-500">
              {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'W'}
            </p>

            {tidePageData?.stationName && (() => {
              const hasCoords = tidePageData.stationLat != null && tidePageData.stationLng != null;
              return (
                <p className="text-xs text-gray-400 mt-1">
                  Station: {tidePageData.stationName}
                  {hasCoords && (
                    <> · {formatDistance(haversineDistance(lat, lng, tidePageData.stationLat ?? 0, tidePageData.stationLng ?? 0))} from selected location</>
                  )}
                  {' '}· Levels relative to chart datum (CD)
                </p>
              );
            })()}
          </div>

          {visibleEvents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tide data available for this location.</p>
          ) : (
            <table className="text-sm" style={{ borderSpacing: '1rem 0', borderCollapse: 'separate' }}>
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                  <th className="pb-2">Time</th>
                  <th className="pb-2 text-right">Level</th>
                  <th className="pb-2 text-left">Type</th>
                  <th className="pb-2" aria-label="Feedback" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const level = tidePageData?.currentLevel;
                  const levelTime = tidePageData?.currentLevelTime;
                  if (level == null || !levelTime) {return null;}
                  const hhmm = new Intl.DateTimeFormat('en-GB', {
                    weekday: 'short', day: 'numeric', month: 'short',
                    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
                  }).format(new Date(levelTime));
                  const nextEvent = visibleEvents[0];
                  const trend = nextEvent ? (nextEvent.flag === 'high' ? 'Rising' : 'Falling') : null;
                  const isLowest = minLow == null || level <= minLow;
                  return (
                    <tr className="text-gray-700 bg-gray-50">
                      <td className="py-2 tabular-nums">{hhmm}</td>
                      <td className="py-2 text-right tabular-nums whitespace-nowrap"
                          style={isLowest ? { fontWeight: 700 } : undefined}>{level.toFixed(1)} cm</td>
                      <td className="py-2 text-xs text-gray-400">Last observation{trend && ` – ${trend}`}</td>
                      <td />
                    </tr>
                  );
                })()}
                {visibleEvents.map((event, i) => {
                  const pred = eventPredictions[i];
                  const isExtreme = pred != null
                    && ((event.flag === 'high' && pred === maxHigh)
                      || (event.flag === 'low' && pred === minLow));
                  return (
                    <tr
                      key={i}
                      className={
                        event.flag === 'high'
                          ? 'text-blue-700'
                          : 'text-teal-700'
                      }
                    >
                      <td className="py-2 tabular-nums">
                        {timeFormatter.format(new Date(event.time))}
                      </td>
                      <td className="py-2 text-right tabular-nums whitespace-nowrap"
                          style={isExtreme ? { fontWeight: 700 } : undefined}>
                        {pred != null ? `${pred.toFixed(1)} cm` : '—'}
                      </td>
                      <td className="py-2 font-semibold">
                        {event.flag === 'high' ? 'High' : 'Low'}
                      </td>
                      <td className="py-2 text-center">
                        <FeedbackButton item={{
                          id: `tide-${event.time}`,
                          page: 'Tide',
                          time: timeFormatter.format(new Date(event.time)),
                          lat,
                          lng,
                          locationName: locationData?.name,
                          summary: `${event.flag === 'high' ? 'High' : 'Low'} tide, ${pred.toFixed(1)} cm`,
                        }} />
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

          <Footer showColumnRef />

        </div>
      </main>

      <FeedbackBanner />
    </div>
  );
}
