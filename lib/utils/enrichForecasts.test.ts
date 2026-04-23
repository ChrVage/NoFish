import { describe, expect, it } from 'vitest';
import { enrichForecasts } from './enrichForecasts';
import type { HourlyForecast } from '@/types/weather';

function mk(time: string, overrides: Partial<HourlyForecast> = {}): HourlyForecast {
  return {
    time,
    ...overrides,
  };
}

describe('enrichForecasts', () => {
  it('returns empty array for empty input', () => {
    expect(enrichForecasts([])).toEqual([]);
  });

  it('trims to last hourly MET row when no wave data exists', () => {
    const data: HourlyForecast[] = [
      mk('2026-04-01T00:00:00.000Z'),
      mk('2026-04-01T01:00:00.000Z'),
      mk('2026-04-01T02:00:00.000Z'),
      mk('2026-04-01T08:00:00.000Z'),
    ];

    const result = enrichForecasts(data);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.time)).toEqual([
      '2026-04-01T00:00:00.000Z',
      '2026-04-01T01:00:00.000Z',
      '2026-04-01T02:00:00.000Z',
    ]);
  });

  it('cuts off at end of wave data when wave series ends before hourly MET rows', () => {
    const data: HourlyForecast[] = [
      mk('2026-04-01T00:00:00.000Z', { waveHeight: 1.0 }),
      mk('2026-04-01T01:00:00.000Z'),
      mk('2026-04-01T02:00:00.000Z', { waveHeight: 2.0 }),
      mk('2026-04-01T03:00:00.000Z'),
      mk('2026-04-01T04:00:00.000Z'),
    ];

    const result = enrichForecasts(data);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.time)).toEqual([
      '2026-04-01T00:00:00.000Z',
      '2026-04-01T01:00:00.000Z',
      '2026-04-01T02:00:00.000Z',
    ]);
  });

  it('backfills leading gaps and interpolates wave values between real points', () => {
    const data: HourlyForecast[] = [
      mk('2026-04-01T00:00:00.000Z'),
      mk('2026-04-01T01:00:00.000Z', { waveHeight: 1.0, waveDirection: 350, wavePeriod: 6 }),
      mk('2026-04-01T02:00:00.000Z'),
      mk('2026-04-01T03:00:00.000Z', { waveHeight: 3.0, waveDirection: 10, wavePeriod: 10 }),
    ];

    const result = enrichForecasts(data);
    expect(result).toHaveLength(4);

    // Leading backfill from first real wave point
    expect(result[0].waveHeight).toBe(1.0);
    expect(result[0].waveDirection).toBe(350);
    expect(result[0].wavePeriod).toBe(6);
    expect(result[0].isInterpolatedWave).toBe(true);

    // Interpolated midpoint between hour 01 and 03
    expect(result[2].waveHeight).toBeCloseTo(2.0, 6);
    expect(result[2].waveDirection).toBeCloseTo(0, 6);
    expect(result[2].wavePeriod).toBeCloseTo(8.0, 6);
    expect(result[2].isInterpolatedWave).toBe(true);
  });
});
