/**
 * GET /api/v1/tide?lat=&lon=[&boat=][&fish=][&method=]
 * Returns high/low tide events for the specified location with API key authentication
 *
 * Query parameters:
 * - lat: Latitude (required)
 * - lon: Longitude (required)
 * - boat: Boat size preset (optional; included for consistency with /score but not used)
 * - fish: Fish target species (optional; included for consistency with /score but not used)
 * - method: Fishing method (optional; included for consistency with /score but not used)
 *
 * Returns JSON with:
 * - events: Array of { time, value_cm, type } where type is 'high' or 'low'
 * - station_name: Name of the tide station
 * - generated_at: ISO timestamp
 * - source_credit: Attribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTideForecast } from '@/lib/api/weather';
import { validateCoordinates } from '@/lib/utils/validation';
import { validateApiKeyHeader, recordApiRequest } from '@/lib/api/apiKeyValidator';

interface ApiTideResponse {
  success: boolean;
  events?: Array<{
    time: string;
    value_cm: number;
    type: 'high' | 'low';
  }>;
  station_name?: string;
  station_lat?: number;
  station_lng?: number;
  error?: string;
  generated_at: string;
  source_credit?: string;
}

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' };
const RATE_LIMIT_CONFIG = { dailyLimit: 100, minuteLimit: 10 };

export async function GET(request: NextRequest) {
  const generatedAt = new Date().toISOString();

  try {
    // Validate API key
    const keyError = await validateApiKeyHeader(request, RATE_LIMIT_CONFIG);
    if (keyError) {
      return keyError;
    }

    const apiKey = request.headers.get('X-Api-Key')?.trim() || '';

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;

    // Coordinates (required)
    const coordResult = validateCoordinates(searchParams.get('lat'), searchParams.get('lon'));
    if (coordResult instanceof NextResponse) {
      return coordResult;
    }
    const { lat: latitude, lng: longitude } = coordResult;

    // Optional parameters (accepted for consistency with /score but not used)
    // const boat = searchParams.get('boat');
    // const fish = searchParams.get('fish');
    // const method = searchParams.get('method');

    // Fetch tide data
    const tideForecast = await getTideForecast(latitude, longitude);

    if (!tideForecast) {
      return NextResponse.json(
        {
          success: false,
          error: 'No tide data available for this location',
          generated_at: generatedAt,
        } satisfies ApiTideResponse,
        { status: 404 }
      );
    }

    // Prepare response
    const response: ApiTideResponse = {
      success: true,
      events: tideForecast.events.map(event => ({
        time: event.time,
        value_cm: event.value,
        type: event.flag,
      })),
      station_name: tideForecast.stationName,
      station_lat: tideForecast.stationLat,
      station_lng: tideForecast.stationLng,
      generated_at: generatedAt,
      source_credit: 'Tide data from Kartverket, weather context from MET Norway & Barentswatch',
    };

    // Record successful API call
    await recordApiRequest(apiKey);

    return NextResponse.json(response, {
      status: 200,
      headers: CACHE_HEADERS,
    });
  } catch (error) {
    console.error('Tide API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        generated_at: new Date().toISOString(),
      } satisfies ApiTideResponse,
      { status: 500 }
    );
  }
}
