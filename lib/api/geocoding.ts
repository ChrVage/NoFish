/**
 * Reverse geocode coordinates to get location name and municipality
 * Uses Nominatim (OpenStreetMap) API
 */
import { getCached, setCached } from '@/lib/db/cache';

export interface GeocodingResult {
  name: string;
  municipality: string;
  county: string;
  country: string;
  displayName: string;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult | null> {
  // Cache key uses 2 dp (≈1 km) — sufficient for municipality-level geocoding
  const cacheKey = `geo:${lat.toFixed(2)}:${lng.toFixed(2)}`;

  const cached = await getCached<GeocodingResult>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
        `format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'NoFish/1.0 (fishing conditions app)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    const address = data.address || {};

    const result: GeocodingResult = {
      name:
        address.village ||
        address.town ||
        address.city ||
        address.hamlet ||
        address.locality ||
        'Unnamed location',
      municipality:
        address.municipality || address.county || 'Unknown municipality',
      county: address.county || address.state || '',
      country: address.country || '',
      displayName: data.display_name || '',
    };

    // Cache for 30 days — places don't move
    await setCached(cacheKey, result, 30 * 24);

    return result;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
