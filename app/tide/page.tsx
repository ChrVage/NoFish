import { notFound } from 'next/navigation';
import { getTideForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import BackButton from './BackButton';
import PageNav from '@/components/PageNav';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string }>;
}

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Europe/Oslo',
});

export default async function TidePage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  const [locationData, tideForecast] = await Promise.all([
    reverseGeocode(lat, lng),
    getTideForecast(lat, lng),
  ]);

  const events = tideForecast?.events ?? [];

  return (
    <div className="min-h-screen bg-ocean-50">
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <span className="text-3xl">🎣</span>
            <h1 className="text-2xl font-bold">NoFish</h1>
          </div>
          <p className="text-ocean-50 text-sm hidden sm:block">Tides</p>
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
            {tideForecast?.stationName && (
              <p className="text-xs text-gray-400 mt-1">
                Station: {tideForecast.stationName}
              </p>
            )}
          </div>

          {events.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tide data available for this location.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400 tracking-wider">
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 text-right">Height</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event, i) => (
                  <tr key={i} className={event.flag === 'high' ? 'text-blue-700' : 'text-teal-700'}>
                    <td className="py-2 pr-4 tabular-nums">
                      {timeFormatter.format(new Date(event.time))}
                    </td>
                    <td className="py-2 pr-4 font-semibold">
                      {event.flag === 'high' ? 'Hi' : 'Lo'}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {event.value} cm
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-100">
            <PageNav lat={lat} lng={lng} current="tide" />
            <BackButton
              label="Select different location"
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
