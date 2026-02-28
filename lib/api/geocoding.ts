/**
 * Reverse geocode coordinates to get location name and municipality
 * Uses Nominatim (OpenStreetMap) API
 */
import { getCached, setCached, withInflight } from '@/lib/db/cache';

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
  // v3 prefix invalidates old entries that lacked sea/fjord/bay fallbacks
  const cacheKey = `geo3:${lat.toFixed(2)}:${lng.toFixed(2)}`;

  const cached = await getCached<GeocodingResult>(cacheKey);
  if (cached) return cached;

  return withInflight<GeocodingResult | null>(cacheKey, async () => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?` +
          `format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
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
          address.suburb ||
          address.neighbourhood ||
          address.body_of_water ||
          address.bay ||
          address.fjord ||
          address.strait ||
          address.sea ||
          address.ocean ||
          address.waterway ||
          address.island ||
          address.archipelago ||
          // Last resort: first segment of Nominatim's display_name
          (data.display_name ? data.display_name.split(',')[0].trim() : undefined) ||
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
  });
}
