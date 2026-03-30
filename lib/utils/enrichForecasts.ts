import type { HourlyForecast } from '@/types/weather';

export type EnrichedForecast = HourlyForecast & { isInterpolatedWave?: boolean };

/**
 * Trim forecasts at the last row with real wave data and linearly interpolate
 * gaps in wave height / direction so every row within the wave range has a value.
 */
export function enrichForecasts(forecasts: HourlyForecast[]): EnrichedForecast[] {
  if (!forecasts.length) return [];

  // Find last 1-hour interval row from MET (where gap to next row jumps from ~1h to ~6h)
  let lastHourlyIndex = forecasts.length - 1;
  for (let i = 0; i < forecasts.length - 1; i++) {
    const gap = new Date(forecasts[i + 1].time).getTime() - new Date(forecasts[i].time).getTime();
    if (gap > 90 * 60_000) { lastHourlyIndex = i; break; }
  }

  // Find last index with real wave data
  let lastWaveIndex = -1;
  for (let i = forecasts.length - 1; i >= 0; i--) {
    if (forecasts[i].waveHeight !== undefined) { lastWaveIndex = i; break; }
  }
  if (lastWaveIndex < 0) return forecasts.slice(0, lastHourlyIndex + 1);

  // Trim at whichever comes first: end of hourly MET data or end of wave data
  const cutoffIndex = Math.min(lastHourlyIndex, lastWaveIndex);

  // Build a map of time → forecast for fast lookup (keyed by ms to avoid ISO format mismatches)
  const timeMap = new Map(forecasts.map(f => [new Date(f.time).getTime(), f]));
  const firstTime = new Date(forecasts[0].time);
  const lastTime = new Date(forecasts[cutoffIndex].time);
  const result: EnrichedForecast[] = [];
  for (let t = new Date(firstTime); t <= lastTime; t.setHours(t.getHours() + 1)) {
    const ms = t.getTime();
    const base = timeMap.get(ms);
    result.push(base ? { ...base } : { time: t.toISOString() });
  }

  // Collect indices with real wave data
  const realIndices: number[] = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i].waveHeight !== undefined) realIndices.push(i);
  }

  // Interpolate between each pair of adjacent real-data points
  for (let k = 0; k < realIndices.length - 1; k++) {
    const a = realIndices[k];
    const b = realIndices[k + 1];
    if (b - a <= 1) continue;

    const tA = new Date(result[a].time).getTime();
    const tB = new Date(result[b].time).getTime();
    const hA = result[a].waveHeight!;
    const hB = result[b].waveHeight!;
    const dA = result[a].waveDirection;
    const dB = result[b].waveDirection;

    for (let i = a + 1; i < b; i++) {
      const t = (new Date(result[i].time).getTime() - tA) / (tB - tA);
      result[i].waveHeight = hA + t * (hB - hA);

      if (dA !== undefined && dB !== undefined) {
        let diff = dB - dA;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        result[i].waveDirection = ((dA + t * diff) % 360 + 360) % 360;
      }
      result[i].isInterpolatedWave = true;
    }
  }

  return result;
}
