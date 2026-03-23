import { notFound } from 'next/navigation';
import { getLocationForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { parseZoomParam } from '@/lib/utils/params';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import Footer from '@/components/Footer';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string }>;
}

export default async function ScorePage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr, zoom: zoomStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');
  const validZoom = parseZoomParam(zoomStr);

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  const [locationData, locationForecast] = await Promise.all([
    reverseGeocode(lat, lng),
    getLocationForecast(lat, lng),
  ]);

  return (
    <div className="min-h-screen bg-ocean-50">
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton label="🎣 NoFish" />
          </div>
          <PageNav lat={lat} lng={lng} zoom={validZoom} current="score" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
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
          </div>

          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <span className="text-6xl">🚧</span>
            <h3 className="text-xl font-semibold text-gray-700">Fishing Score — Coming Soon</h3>
            <p className="text-gray-500 max-w-sm">
              This page will show a combined fishing score based on tides, weather, and seasonal conditions.
            </p>
          </div>


        </div>
      </main>

      <Footer />
    </div>
  );
}
