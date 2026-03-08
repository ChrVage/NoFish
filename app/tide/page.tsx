import { notFound } from 'next/navigation';
import { getTideForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { getTimezone, getTimezoneLabel } from '@/lib/utils/timezone';
import { haversineDistance, formatDistance } from '@/lib/utils/distance';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import Footer from '@/components/Footer';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string }>;
}

export default async function TidePage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr, zoom: zoomStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');
  const zoom = zoomStr !== undefined ? parseInt(zoomStr, 10) : undefined;

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  const [locationData, tideForecast] = await Promise.all([
    reverseGeocode(lat, lng),
    getTideForecast(lat, lng),
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
  const events = tideForecast?.events ?? [];

  const highEvents = events.filter((e) => e.flag === 'high');
  const lowEvents  = events.filter((e) => e.flag === 'low');
  const maxHighValue = highEvents.length ? Math.max(...highEvents.map((e) => e.value)) : null;
  const minLowValue  = lowEvents.length  ? Math.min(...lowEvents.map((e) => e.value))  : null;

  return (
    <div className="min-h-screen bg-ocean-50">
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton label="← 🎣 NoFish" className="text-sm font-normal text-white hover:text-ocean-200 transition-colors" />
          </div>
          <PageNav lat={lat} lng={lng} zoom={zoom !== undefined && !isNaN(zoom) ? zoom : undefined} current="tide" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
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
            <p className="text-xs text-gray-400 mt-1">
              Times shown in local time · {timezoneLabel}
            </p>
            {tideForecast?.stationName && (() => {
              const hasCoords = tideForecast.stationLat != null && tideForecast.stationLng != null;
              return (
                <p className="text-xs text-gray-400 mt-1">
                  Station: {tideForecast.stationName}
                  {hasCoords && (
                    <> · {formatDistance(haversineDistance(lat, lng, tideForecast.stationLat!, tideForecast.stationLng!))} from selected location</>
                  )}
                </p>
              );
            })()}
          </div>

          {events.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tide data available for this location.</p>
          ) : (
            <table className="text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400 tracking-wider">
                  <th className="pb-2 pr-6">Time</th>
                  <th className="pb-2 pr-6 text-center">Type</th>
                  <th className="pb-2 pr-2 text-right">Height</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event, i) => {
                  const isPeakHigh = event.flag === 'high' && event.value === maxHighValue;
                  const isPeakLow  = event.flag === 'low'  && event.value === minLowValue;
                  return (
                    <tr
                      key={i}
                      className={
                        isPeakHigh
                          ? 'bg-blue-50 text-blue-800 font-bold'
                          : isPeakLow
                          ? 'bg-teal-50 text-teal-800 font-bold'
                          : event.flag === 'high'
                          ? 'text-blue-700'
                          : 'text-teal-700'
                      }
                    >
                      <td className="py-2 pr-6 tabular-nums">
                        {timeFormatter.format(new Date(event.time))}
                      </td>
                      <td className="py-2 pr-6 font-semibold text-center">
                        {event.flag === 'high' ? 'Hi' : 'Lo'}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums whitespace-nowrap">
                        {Math.round(event.value)} cm
                      </td>
                      <td className="py-2 w-10 text-xs font-normal opacity-60 whitespace-nowrap">
                        {isPeakHigh && '↑ max'}
                        {isPeakLow  && '↓ min'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}


        </div>
      </main>

      <Footer />
    </div>
  );
}
