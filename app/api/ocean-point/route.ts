import { NextRequest, NextResponse } from 'next/server';
import { getWaveGridPoint } from '@/lib/api/barentswatch';
import { validateCoordinates } from '@/lib/utils/validation';
import { checkRateLimit } from '@/lib/utils/rateLimit';

export interface OceanPointResponse {
  success: boolean;
  oceanForecastLat?: number;
  oceanForecastLng?: number;
  error?: string;
}

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' };
const RATE_LIMIT = { name: 'ocean-point', limit: 60, windowSeconds: 60 };

export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, RATE_LIMIT);
  if (limited) {return limited;}

  const searchParams = request.nextUrl.searchParams;
  const result = validateCoordinates(searchParams.get('lat'), searchParams.get('lon'));
  if (result instanceof NextResponse) {return result;}
  const { lat: latitude, lng: longitude } = result;

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
