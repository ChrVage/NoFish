/**
 * Reverse geocode coordinates to get location name and municipality
 * Uses Nominatim (OpenStreetMap) API
 */
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

    return {
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
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}
