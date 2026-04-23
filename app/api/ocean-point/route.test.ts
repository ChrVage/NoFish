import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const getWaveGridPointMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/barentswatch', () => ({
  getWaveGridPoint: getWaveGridPointMock,
}));

vi.mock('@/lib/utils/rateLimit', () => ({
  checkRateLimit: checkRateLimitMock,
}));

import { GET } from './route';

describe('GET /api/ocean-point', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    checkRateLimitMock.mockReturnValue(null);
  });

  it('returns grid point coordinates for valid requests', async () => {
    getWaveGridPointMock.mockResolvedValue({ lat: 63.44, lng: 10.41 });

    const request = new NextRequest('http://localhost/api/ocean-point?lat=63.4305&lon=10.3951');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=3600, stale-while-revalidate=7200');
    expect(body).toEqual({
      success: true,
      oceanForecastLat: 63.44,
      oceanForecastLng: 10.41,
    });
  });

  it('returns success true with missing forecast coordinates when no nearby wave point', async () => {
    getWaveGridPointMock.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/ocean-point?lat=63.4305&lon=10.3951');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it('returns 400 for invalid coordinates', async () => {
    const request = new NextRequest('http://localhost/api/ocean-point?lat=abc&lon=10.3951');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ success: false, error: 'Invalid coordinates' });
  });

  it('returns rate-limit response when blocked', async () => {
    checkRateLimitMock.mockReturnValue(
      NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    );

    const request = new NextRequest('http://localhost/api/ocean-point?lat=63.4305&lon=10.3951');
    const response = await GET(request);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Too many requests',
    });
  });

  it('returns 500 if upstream lookup throws', async () => {
    getWaveGridPointMock.mockRejectedValue(new Error('upstream failed'));

    const request = new NextRequest('http://localhost/api/ocean-point?lat=63.4305&lon=10.3951');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ success: false, error: 'Internal server error' });
  });
});
