import { NextRequest, NextResponse } from 'next/server';
import { getLocationForecast } from '@/lib/api/weather';
import { validateCoordinates } from '@/lib/utils/validation';
import { checkRateLimit } from '@/lib/utils/rateLimit';

export interface WeatherPointResponse {
  success: boolean;
  weatherForecastLat?: number;
  weatherForecastLng?: number;
  error?: string;
}

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' };
const RATE_LIMIT = { name: 'weather-point', limit: 60, windowSeconds: 60 };

export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, RATE_LIMIT);
  if (limited) {return limited;}

  const searchParams = request.nextUrl.searchParams;
  const result = validateCoordinates(searchParams.get('lat'), searchParams.get('lon'));
  if (result instanceof NextResponse) {return result;}
  const { lat: latitude, lng: longitude } = result;

  try {
    const forecast = await getLocationForecast(latitude, longitude);
    const weatherForecastLng = forecast.geometry.coordinates[0];
    const weatherForecastLat = forecast.geometry.coordinates[1];

    return NextResponse.json(
      {
        success: true,
        weatherForecastLat,
        weatherForecastLng,
      } satisfies WeatherPointResponse,
      { status: 200, headers: CACHE_HEADERS },
    );
  } catch (error) {
    console.error('Weather-point API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } satisfies WeatherPointResponse,
      { status: 500 },
    );
  }
}