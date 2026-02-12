import { NextRequest, NextResponse } from 'next/server';
import { WeatherApiResponse } from '@/types/api';

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

    // TODO: Implement weather API integration
    // This is a placeholder response
    return NextResponse.json(
      {
        success: true,
        message: 'Weather API endpoint - implementation pending',
      } as WeatherApiResponse,
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as WeatherApiResponse,
      { status: 500 }
    );
  }
}
