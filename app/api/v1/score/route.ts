/**
 * GET /api/v1/score?lat=&lon=[&boat=][&fish=][&method=][&depth=]
 * Returns best fishing windows and hourly scores with API key authentication
 *
 * Query parameters:
 * - lat: Latitude (required)
 * - lon: Longitude (required)
 * - boat: Boat size preset (optional: 15-19, 20-24, 25-30, 31-40; defaults to 20-24)
 * - fish: Fish target species (optional: cod, saithe, haddock, etc.; defaults to cod)
 * - method: Fishing method (optional: rod, net, jig, etc.; defaults to rod)
 * - depth: Water depth in meters (optional; defaults to 50-200m profile)
 *
 * Returns JSON with:
 * - best_windows: Array of { start_hour, duration_hours, average_score }
 * - hourly_scores: Array of { time, score, safety_score, fishing_score }
 * - generated_at: ISO timestamp
 * - source_credit: Attribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCombinedForecast } from '@/lib/api/weather';
import { computeFishingScore, findBestWindows, type ComputeScoreOptions } from '@/lib/scoring/fishingScore';
import { validateCoordinates } from '@/lib/utils/validation';
import { validateApiKeyHeader, recordApiRequest } from '@/lib/api/apiKeyValidator';
import { enrichForecasts } from '@/lib/utils/enrichForecasts';
import type { BoatSizePreset, FishTarget, FishingMethod } from '@/lib/utils/tuning';

interface ApiScoreResponse {
  success: boolean;
  best_windows?: Array<{
    start_hour: number;
    duration_hours: number;
    average_score: number;
  }>;
  hourly_scores?: Array<{
    time: string;
    score: number;
    safety_score: number;
    fishing_score: number;
  }>;
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

    const apiKey = request.headers.get('X-Api-Key')?.trim() ?? '';

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;

    // Coordinates (required)
    const coordResult = validateCoordinates(searchParams.get('lat'), searchParams.get('lon'));
    if (coordResult instanceof NextResponse) {
      return coordResult;
    }
    const { lat: latitude, lng: longitude } = coordResult;

    // Optional parameters with defaults
    const boat = (searchParams.get('boat') ?? 'undefined') as BoatSizePreset | 'undefined';
    const fish = (searchParams.get('fish') ?? 'undefined') as FishTarget | 'undefined';
    const method = (searchParams.get('method') ?? 'undefined') as FishingMethod | 'undefined';
    const depthParam = searchParams.get('depth');
    const depth = depthParam ? parseInt(depthParam, 10) : undefined;

    // Validate depth if provided
    if (depth !== undefined && (isNaN(depth) || depth < 0 || depth > 1000)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid depth: must be a number between 0 and 1000',
          generated_at: generatedAt,
        } satisfies ApiScoreResponse,
        { status: 400 }
      );
    }

    // Fetch combined forecast data
    const combined = await getCombinedForecast(latitude, longitude);

    if (!combined || combined.forecasts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No forecast data available for this location',
          generated_at: generatedAt,
        } satisfies ApiScoreResponse,
        { status: 404 }
      );
    }

    // Enrich forecasts with calculated fields (sun phase, moon phase, etc.)
    const enriched = enrichForecasts(combined.forecasts);

    // Build options object for scoring
    const scoreOptions: ComputeScoreOptions = {
      depth: depth,
      boat: boat === 'undefined' ? undefined : boat,
      fish: fish === 'undefined' ? undefined : fish,
      method: method === 'undefined' ? undefined : method,
      timezone: combined.timezone,
    };

    // Compute scores for each hour
    const scoredForecasts = enriched.map(forecast => ({
      forecast,
      ...computeFishingScore(forecast, scoreOptions),
    }));

    // Find best fishing windows
    const bestWindows = findBestWindows(scoredForecasts, scoreOptions);

    // Prepare response
    const response: ApiScoreResponse = {
      success: true,
      best_windows: bestWindows.map(w => ({
        start_hour: w.start,
        duration_hours: w.len,
        average_score: Math.round(w.avg),
      })),
      hourly_scores: scoredForecasts.map(sf => ({
        time: sf.forecast.time,
        score: Math.round(sf.score),
        safety_score: Math.round(sf.safetyScore),
        fishing_score: Math.round(sf.fishingScore),
      })),
      generated_at: generatedAt,
      source_credit: 'Data from MET Norway (weather), Barentswatch (waves, currents), Kartverket (tide)',
    };

    // Record successful API call
    await recordApiRequest(apiKey);

    return NextResponse.json(response, {
      status: 200,
      headers: CACHE_HEADERS,
    });
  } catch (error) {
    console.error('Score API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        generated_at: new Date().toISOString(),
      } satisfies ApiScoreResponse,
      { status: 500 }
    );
  }
}
