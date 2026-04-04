import { NextRequest, NextResponse } from 'next/server';
import { getWaveGridPoint } from '@/lib/api/barentswatch';

export interface OceanPointResponse {
  success: boolean;
  oceanForecastLat?: number;
  oceanForecastLng?: number;
  error?: string;
}

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' };

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
    // Lightweight: only calls Barentswatch wave API (1 upstream request)
    const gridPoint = await getWaveGridPoint(latitude, longitude);
    return NextResponse.json(
      {
        success: true,
        oceanForecastLat: gridPoint?.lat,
        oceanForecastLng: gridPoint?.lng,
      } satisfies OceanPointResponse,
      { status: 200, headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Ocean-point API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } satisfies OceanPointResponse,
      { status: 500 }
    );
  }
}
