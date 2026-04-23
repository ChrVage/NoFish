import { describe, expect, it } from 'vitest';
import { formatDistance, haversineDistance } from './distance';

describe('haversineDistance', () => {
  it('returns zero for identical points', () => {
    expect(haversineDistance(63.4305, 10.3951, 63.4305, 10.3951)).toBeCloseTo(0, 10);
  });

  it('returns a realistic distance for known coordinates', () => {
    // Trondheim -> Oslo is roughly 392 km great-circle distance
    const km = haversineDistance(63.4305, 10.3951, 59.9139, 10.7522);
    expect(km).toBeGreaterThan(380);
    expect(km).toBeLessThan(410);
  });
});

describe('formatDistance', () => {
  it('shows meters for distances below 1 km', () => {
    expect(formatDistance(0.456)).toBe('456 m');
  });

  it('shows one decimal km for distances of 1 km and above', () => {
    expect(formatDistance(1)).toBe('1.0 km');
    expect(formatDistance(12.34)).toBe('12.3 km');
  });
});
