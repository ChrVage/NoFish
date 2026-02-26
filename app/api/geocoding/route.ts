import { NextRequest, NextResponse } from 'next/server';
import { reverseGeocode } from '@/lib/api/geocoding';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ success: false, error: 'Missing required parameters: lat and lon' }, { status: 400 });
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json({ success: false, error: 'Invalid coordinates' }, { status: 400 });
  }

  try {
    const data = await reverseGeocode(latitude, longitude);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
