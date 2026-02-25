import { notFound } from 'next/navigation';
import { reverseGeocode } from '@/lib/api/geocoding';
import BackButton from './BackButton';
import PageNav from '@/components/PageNav';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string }>;
}

export default async function ScorePage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  const locationData = await reverseGeocode(lat, lng);

  return (
    <div className="min-h-screen bg-ocean-50">
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <span className="text-3xl">🎣</span>
            <h1 className="text-2xl font-bold">NoFish</h1>
          </div>
          <p className="text-ocean-50 text-sm hidden sm:block">Fishing Score</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
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
          </div>

          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <span className="text-6xl">🚧</span>
            <h3 className="text-xl font-semibold text-gray-700">Fishing Score — Coming Soon</h3>
            <p className="text-gray-500 max-w-sm">
              This page will show a combined fishing score based on tides, weather, and seasonal conditions.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <PageNav lat={lat} lng={lng} current="score" />
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
