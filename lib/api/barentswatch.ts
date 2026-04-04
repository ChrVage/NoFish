/**
 * Barentswatch Waveforecast & Sea Current API integration
 * Uses OAuth2 client-credentials flow for authentication.
 * Docs: https://developer.barentswatch.no/
 */

import type { BarentswatchWaveResponse, BarentswatchSeaCurrentResponse } from '@/types/weather';
import { getCached, setCached, withInflight } from '@/lib/db/cache';
import { haversineDistance } from '@/lib/utils/distance';

const TOKEN_URL = 'https://id.barentswatch.no/connect/token';
const WAVE_API_URL = 'https://www.barentswatch.no/bwapi/v1/waveforecastpoint/nearest/all';
const CURRENT_API_URL = 'https://www.barentswatch.no/bwapi/v1/seacurrent/nearest/all';

// In-memory token cache (server process lifetime)
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Obtain an OAuth2 access token using client credentials.
 * Tokens are cached in memory until ~60 s before expiry.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.BARENTSWATCH_CLIENT_ID;
  const clientSecret = process.env.BARENTSWATCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('BARENTSWATCH_CLIENT_ID and BARENTSWATCH_CLIENT_SECRET must be set');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'api',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Barentswatch token request failed ${response.status}: ${text}`);
  }

  const data: { access_token: string; expires_in: number } = await response.json();
  cachedToken = data.access_token;
  // Refresh 60 s before actual expiry to avoid edge-case failures
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken;
}

/**
 * Fetch wave forecast for a specific point from Barentswatch.
 * Returns null if the API has no data for this location (e.g. inland).
 */
export async function getWaveForecast(
  lat: number,
  lng: number
): Promise<BarentswatchWaveResponse | null> {
  try {
    const token = await getAccessToken();

    // Barentswatch uses x=longitude, y=latitude
    const response = await fetch(
      `${WAVE_API_URL}?x=${lng.toFixed(4)}&y=${lat.toFixed(4)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    // 204 = no data available for this point (inland, out of range, etc.)
    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      console.warn(`Barentswatch wave API returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    // The API may return an empty array for locations without wave data
    if (Array.isArray(data) && data.length === 0) {
      return null;
    }

    return data as BarentswatchWaveResponse;
  } catch (error) {
    console.error('Barentswatch wave forecast error:', error);
    return null;
  }
}

/**
 * Fetch sea current forecast for a specific point from Barentswatch.
 * Returns null if the API has no data for this location (e.g. inland).
 */
export async function getSeaCurrentForecast(
  lat: number,
  lng: number
): Promise<BarentswatchSeaCurrentResponse | null> {
  try {
    const token = await getAccessToken();

    // Barentswatch uses x=longitude, y=latitude
    const response = await fetch(
      `${CURRENT_API_URL}?x=${lng.toFixed(4)}&y=${lat.toFixed(4)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    // 204 = no data available for this point (inland, out of range, etc.)
    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      console.warn(`Barentswatch current API returned ${response.status}`);
      return null;
    }

    const data = await response.json();

    // The API may return an empty array for locations without current data
    if (Array.isArray(data) && data.length === 0) {
      return null;
    }

    return data as BarentswatchSeaCurrentResponse;
  } catch (error) {
    console.error('Barentswatch sea current forecast error:', error);
    return null;
  }
}

// ── Lightweight grid-point lookup (for ocean-point API route) ───────────────

/** Maximum distance (km) between the requested point and the wave forecast grid point. */
const MAX_WAVE_GRID_DISTANCE_KM = 1;

export interface WaveGridPoint {
  lat: number;
  lng: number;
}

/** Wrapper so we can cache "no data" distinctly from a cache miss. */
interface WaveGridPointCache {
  point: WaveGridPoint | null;
}

/**
 * Return just the Barentswatch wave-forecast grid-point coordinates for a
 * location, or null when no wave data is available nearby.
 *
 * Much cheaper than getCombinedForecast — only calls the Barentswatch wave
 * API (1 upstream request vs 5).  Cached independently for 1 hour.
 */
export async function getWaveGridPoint(
  lat: number,
  lng: number,
): Promise<WaveGridPoint | null> {
  const cacheKey = `wavepoint:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cached = await getCached<WaveGridPointCache>(cacheKey);
  if (cached !== null) return cached.point;

  return withInflight<WaveGridPoint | null>(cacheKey, async () => {
    const waveForecast = await getWaveForecast(lat, lng);

    if (!waveForecast || waveForecast.length === 0) {
      await setCached(cacheKey, { point: null } satisfies WaveGridPointCache, 1);
      return null;
    }

    const gridLat = waveForecast[0].latitude;
    const gridLng = waveForecast[0].longitude;

    if (gridLat == null || gridLng == null) {
      await setCached(cacheKey, { point: null } satisfies WaveGridPointCache, 1);
      return null;
    }

    const distance = haversineDistance(lat, lng, gridLat, gridLng);
    if (distance > MAX_WAVE_GRID_DISTANCE_KM) {
      await setCached(cacheKey, { point: null } satisfies WaveGridPointCache, 1);
      return null;
    }

    const result: WaveGridPoint = { lat: gridLat, lng: gridLng };
    await setCached(cacheKey, { point: result } satisfies WaveGridPointCache, 1);
    return result;
  });
}
