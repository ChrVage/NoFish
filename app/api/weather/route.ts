import { NextRequest, NextResponse } from 'next/server';
import { getCombinedForecast } from '@/lib/api/weather';
import { validateCoordinates } from '@/lib/utils/validation';
import { checkRateLimit } from '@/lib/utils/rateLimit';
import type { HourlyForecast } from '@/types/weather';

export interface WeatherApiResponse {
  success: boolean;
  data?: HourlyForecast[];
  oceanForecastLat?: number;
  oceanForecastLng?: number;
  error?: string;
  metadata?: Record<string, never>;
}

const RATE_LIMIT = { name: 'weather', limit: 30, windowSeconds: 60 };

export async function GET(request: NextRequest) {
  try {
    const limited = checkRateLimit(request, RATE_LIMIT);
    if (limited) {return limited;}

    const searchParams = request.nextUrl.searchParams;
    const result = validateCoordinates(searchParams.get('lat'), searchParams.get('lon'));
    if (result instanceof NextResponse) {return result;}
    const { lat: latitude, lng: longitude } = result;

    // Fetch combined weather, ocean, and tide forecast
    const forecast = await getCombinedForecast(latitude, longitude);

    return NextResponse.json(
      {
        success: true,
        data: forecast.forecasts,
        oceanForecastLat: forecast.oceanForecastLat,
        oceanForecastLng: forecast.oceanForecastLng,
        metadata: forecast.metadata,
      } as WeatherApiResponse,
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } }
    );
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 
      } as WeatherApiResponse,
      { status: 500 }
    );
  }
}
