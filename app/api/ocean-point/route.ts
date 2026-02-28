import { NextRequest, NextResponse } from 'next/server';
import { getCombinedForecast } from '@/lib/api/weather';

export interface OceanPointResponse {
  success: boolean;
  oceanForecastLat?: number;
  oceanForecastLng?: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameters: lat and lon' } satisfies OceanPointResponse,
      { status: 400 }
    );
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json(
      { success: false, error: 'Invalid coordinates' } satisfies OceanPointResponse,
      { status: 400 }
    );
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json(
      { success: false, error: 'Coordinates out of range: lat must be −90–90, lon must be −180–180' } satisfies OceanPointResponse,
      { status: 400 }
    );
  }

  try {
    // getCombinedForecast is cache-backed — no extra upstream request when cache is warm
    const result = await getCombinedForecast(latitude, longitude);
    return NextResponse.json(
      {
        success: true,
        oceanForecastLat: result.oceanForecastLat,
        oceanForecastLng: result.oceanForecastLng,
      } satisfies OceanPointResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Ocean-point API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } satisfies OceanPointResponse,
      { status: 500 }
    );
  }
}
