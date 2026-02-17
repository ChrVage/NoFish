import { NextRequest, NextResponse } from 'next/server';

export interface GeocodingApiResponse {
  success: boolean;
  data?: {
    name: string;
    municipality: string;
    county: string;
    country: string;
    displayName: string;
  };
  error?: string;
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
        } as GeocodingApiResponse,
        { status: 400 }
      );
    }

    // Call Nominatim API server-side
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
        `format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'NoFish/1.0 (fishing conditions app)',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Geocoding service returned ${response.status}`,
        } as GeocodingApiResponse,
        { status: response.status }
      );
    }

    const data = await response.json();
    const address = data.address || {};

    return NextResponse.json(
      {
        success: true,
        data: {
          name:
            address.village ||
            address.town ||
            address.city ||
            address.hamlet ||
            address.municipality ||
            address.county ||
            address.state ||
            address.locality ||
            'Unnamed location',
          municipality:
            address.municipality || address.county || 'Unknown municipality',
          county: address.county || address.state || '',
          country: address.country || '',
          displayName: data.display_name || '',
        },
      } as GeocodingApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as GeocodingApiResponse,
      { status: 500 }
    );
  }
}
