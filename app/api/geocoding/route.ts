import { NextRequest, NextResponse } from 'next/server';
import { reverseGeocode } from '@/lib/api/geocoding';
import { validateCoordinates } from '@/lib/utils/validation';
import { checkRateLimit } from '@/lib/utils/rateLimit';

const RATE_LIMIT = { name: 'geocoding', limit: 60, windowSeconds: 60 };

export async function GET(request: NextRequest) {
  const limited = checkRateLimit(request, RATE_LIMIT);
  if (limited) {return limited;}

  const searchParams = request.nextUrl.searchParams;
  const result = validateCoordinates(searchParams.get('lat'), searchParams.get('lon'));
  if (result instanceof NextResponse) {return result;}
  const { lat: latitude, lng: longitude } = result;

  try {
    const data = await reverseGeocode(latitude, longitude);
    return NextResponse.json(
      {
        success: true,
        data,
        elevation: data?.elevation,
        terrain: data?.terrain,
        isSea: data?.isSea,
        objectType: data?.objectType,
        kommuneNr: data?.kommuneNr,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' } }
    );
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
