import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const reverseGeocodeMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/geocoding', () => ({
  reverseGeocode: reverseGeocodeMock,
}));

vi.mock('@/lib/utils/rateLimit', () => ({
  checkRateLimit: checkRateLimitMock,
}));

import { GET } from './route';

describe('GET /api/geocoding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    checkRateLimitMock.mockReturnValue(null);
  });

  it('returns geocoding payload and projection fields on success', async () => {
    reverseGeocodeMock.mockResolvedValue({
      name: 'Munkholmen',
      municipality: 'Trondheim',
      county: 'Trondelag',
      country: 'Norway',
      displayName: 'Munkholmen, Trondheim, Trondelag, Norway',
      elevation: -22,
      terrain: 'Hav',
      isSea: true,
      objectType: 'Skjaer i sjo',
      kommuneNr: '5001',
    });

    const request = new NextRequest('http://localhost/api/geocoding?lat=63.4305&lon=10.3951');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=172800');
    expect(body).toMatchObject({
      success: true,
      elevation: -22,
      terrain: 'Hav',
      isSea: true,
      objectType: 'Skjaer i sjo',
      kommuneNr: '5001',
    });
    expect(body.data).toMatchObject({ name: 'Munkholmen' });
  });

  it('returns 400 for missing coordinates', async () => {
    const request = new NextRequest('http://localhost/api/geocoding?lat=63.4305');
    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Missing required parameters: lat and lon',
    });
  });

  it('returns rate-limit response when blocked', async () => {
    checkRateLimitMock.mockReturnValue(
      NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    );

    const request = new NextRequest('http://localhost/api/geocoding?lat=63.4305&lon=10.3951');
    const response = await GET(request);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Too many requests',
    });
  });

  it('returns 500 if reverse geocoding throws', async () => {
    reverseGeocodeMock.mockRejectedValue(new Error('upstream failed'));

    const request = new NextRequest('http://localhost/api/geocoding?lat=63.4305&lon=10.3951');
    const response = await GET(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Internal server error',
    });
  });
});
