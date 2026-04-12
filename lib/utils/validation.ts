import { NextResponse } from 'next/server';

export interface ValidatedCoordinates {
  lat: number;
  lng: number;
}

/**
 * Parse and validate lat/lon query parameters.
 * Returns { lat, lng } on success, or a NextResponse 400 error on failure.
 */
export function validateCoordinates(
  lat: string | null,
  lon: string | null,
): ValidatedCoordinates | NextResponse {
  if (!lat || !lon) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameters: lat and lon' },
      { status: 400 },
    );
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json(
      { success: false, error: 'Invalid coordinates' },
      { status: 400 },
    );
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json(
      { success: false, error: 'Coordinates out of range: lat must be -90–90, lon must be -180–180' },
      { status: 400 },
    );
  }

  return { lat: latitude, lng: longitude };
}
