import { NextRequest, NextResponse } from 'next/server';
import { getCombinedForecast } from '@/lib/api/weather';
import type { HourlyForecast } from '@/types/weather';

export interface WeatherApiResponse {
  success: boolean;
  data?: HourlyForecast[];
  error?: string;
  metadata?: {
    tideDataSource?: 'real' | 'sample';
    tideDataMessage?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');

    if (!lat || !lon) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: lat and lon',
        } as WeatherApiResponse,
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid coordinates',
        } as WeatherApiResponse,
        { status: 400 }
      );
    }

    // Fetch combined weather, ocean, and tide forecast
    const result = await getCombinedForecast(latitude, longitude);

    return NextResponse.json(
      {
        success: true,
        data: result.forecasts,
        metadata: result.metadata,
      } as WeatherApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as WeatherApiResponse,
      { status: 500 }
    );
  }
}
