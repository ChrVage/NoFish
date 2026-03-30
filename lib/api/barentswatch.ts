/**
 * Barentswatch Waveforecast & Sea Current API integration
 * Uses OAuth2 client-credentials flow for authentication.
 * Docs: https://developer.barentswatch.no/
 */

import type { BarentswatchWaveResponse, BarentswatchSeaCurrentResponse } from '@/types/weather';

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
