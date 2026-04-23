import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';
import { validateCoordinates } from './validation';

describe('validateCoordinates', () => {
  it('returns parsed coordinates for valid lat/lon', () => {
    const result = validateCoordinates('63.4305', '10.3951');
    expect(result).toEqual({ lat: 63.4305, lng: 10.3951 });
  });

  it('returns 400 for missing parameters', async () => {
    const result = validateCoordinates(null, '10.3951');
    expect(result).toBeInstanceOf(NextResponse);

    const response = result as NextResponse;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Missing required parameters: lat and lon',
    });
  });

  it('returns 400 for non-numeric values', async () => {
    const result = validateCoordinates('north', 'east');
    expect(result).toBeInstanceOf(NextResponse);

    const response = result as NextResponse;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Invalid coordinates',
    });
  });

  it('returns 400 for out-of-range values', async () => {
    const result = validateCoordinates('95', '200');
    expect(result).toBeInstanceOf(NextResponse);

    const response = result as NextResponse;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Coordinates out of range: lat must be -90–90, lon must be -180–180',
    });
  });
});
