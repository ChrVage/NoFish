import { NextRequest, NextResponse } from 'next/server';
import { insertLookup, ensureTable } from '@/lib/db/lookups';

// Ensure the table exists once per cold start (idempotent)
const tableReady = ensureTable().catch((err) => {
  console.error('Failed to ensure lookups table:', err);
});

export interface LogApiResponse {
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await tableReady;

    const body = await request.json();
    const { lat, lon, locationName, municipality, county } = body;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return NextResponse.json(
        { success: false, error: 'lat and lon must be numbers' } as LogApiResponse,
        { status: 400 }
      );
    }

    // Extract client IP — Vercel sets x-forwarded-for; fall back to x-real-ip
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded
      ? forwarded.split(',')[0].trim()
      : (request.headers.get('x-real-ip') ?? undefined);

    const userAgent = request.headers.get('user-agent') ?? undefined;

    await insertLookup({
      lat,
      lon,
      locationName: locationName ?? undefined,
      municipality: municipality ?? undefined,
      county: county ?? undefined,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true } as LogApiResponse);
  } catch (error) {
    console.error('Failed to log lookup:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as LogApiResponse,
      { status: 500 }
    );
  }
}
