import { notFound } from 'next/navigation';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { getTimezone } from '@/lib/utils/timezone';
import { parseZoomParam } from '@/lib/utils/params';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import Footer from '@/components/Footer';
import type { HourlyForecast } from '@/types/weather';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string }>;
}

// ── Sun-phase background colour (same as ForecastTable Time column) ─────────
const sunPhaseColors: Record<string, [number, number, number]> = {
  day:      [255, 255, 255],
  civil:    [190, 195, 210],
  nautical: [30,  50,  90],
  night:    [0,   0,   0],
};

function getTimeColumnStyle(
  segments: { phase: string; fraction: number }[] | undefined,
): React.CSSProperties {
  if (!segments || segments.length === 0) return {};
  let r = 0, g = 0, b = 0;
  for (const seg of segments) {
    const c = sunPhaseColors[seg.phase] ?? [128, 128, 128];
    r += c[0] * seg.fraction;
    g += c[1] * seg.fraction;
    b += c[2] * seg.fraction;
  }
  r = Math.round(r); g = Math.round(g); b = Math.round(b);
  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  const textColor = luminance < 140 ? '#ffffff' : '#111827';
  return { backgroundColor: `rgb(${r}, ${g}, ${b})`, color: textColor };
}

// ── Fishing score calculation ───────────────────────────────────────────────
function computeFishingScore(f: HourlyForecast): { score: number; reasons: string[] } {
  let score = 50; // start at midpoint
  const reasons: string[] = [];

  // Wind (0–25 m/s range). Ideal: 2–6 m/s. Calm is okay, strong is bad.
  if (f.windSpeed !== undefined) {
    if (f.windSpeed <= 1) { score += 5; reasons.push('Calm wind'); }
    else if (f.windSpeed <= 6) { score += 10; reasons.push('Light wind'); }
    else if (f.windSpeed <= 10) { score -= 5; reasons.push('Moderate wind'); }
    else if (f.windSpeed <= 15) { score -= 15; reasons.push('Strong wind'); }
    else { score -= 25; reasons.push('Very strong wind'); }
  }

  // Gusts
  if (f.windGust !== undefined && f.windGust > 12) {
    score -= 5;
    reasons.push('Gusty');
  }

  // Precipitation — less is better
  if (f.precipitation !== undefined) {
    if (f.precipitation === 0) { score += 5; reasons.push('Dry'); }
    else if (f.precipitation <= 0.5) { /* neutral */ }
    else if (f.precipitation <= 2) { score -= 5; reasons.push('Light rain'); }
    else { score -= 15; reasons.push('Heavy rain'); }
  }

  // Wave height — calm to moderate is best
  if (f.waveHeight !== undefined) {
    if (f.waveHeight <= 0.5) { score += 10; reasons.push('Calm seas'); }
    else if (f.waveHeight <= 1.0) { score += 5; reasons.push('Low waves'); }
    else if (f.waveHeight <= 1.5) { /* neutral */ }
    else if (f.waveHeight <= 2.5) { score -= 10; reasons.push('Choppy'); }
    else { score -= 20; reasons.push('Rough seas'); }
  }

  // Cloud cover — overcast / partly cloudy is slightly good
  if (f.cloudCover !== undefined) {
    if (f.cloudCover >= 50 && f.cloudCover <= 90) { score += 5; reasons.push('Overcast'); }
    else if (f.cloudCover < 20) { score -= 3; reasons.push('Clear sky'); }
  }

  // Tide phase — changing tide is best for fishing
  if (f.tidePhase) {
    const tp = f.tidePhase.toLowerCase();
    if (tp.includes('hi') || tp.includes('lo')) {
      // At the turn — slack water
      if (tp.match(/^(hi|lo)$/i) || tp.includes('(')) {
        score -= 5; reasons.push('Slack tide');
      } else {
        // Near a turn (e.g. Hi-1, Lo+1) — good current starting/ending
        score += 8; reasons.push('Tide turning');
      }
    } else if (tp.includes('rising') || tp.includes('falling')) {
      score += 10; reasons.push('Moving tide');
    }
  }

  // Sun phase — daylight best, dawn/dusk excellent, night poor
  if (f.sunPhaseSegments && f.sunPhaseSegments.length > 0) {
    const dominant = f.sunPhaseSegments.reduce((a, b) => b.fraction > a.fraction ? b : a);
    if (dominant.phase === 'day') {
      // Check if it's dawn or dusk (civil fraction present)
      const hasCivil = f.sunPhaseSegments.some(s => s.phase === 'civil' && s.fraction > 0.1);
      if (hasCivil) { score += 10; reasons.push('Dawn/dusk'); }
      else { score += 5; reasons.push('Daylight'); }
    } else if (dominant.phase === 'civil') {
      score += 10; reasons.push('Twilight');
    } else if (dominant.phase === 'nautical') {
      score -= 5; reasons.push('Dark');
    } else {
      score -= 10; reasons.push('Night');
    }
  }

  // Pressure trend not available per-row, but stable high pressure is generally good
  if (f.pressure !== undefined) {
    if (f.pressure >= 1015 && f.pressure <= 1030) { score += 3; }
    else if (f.pressure < 1000) { score -= 5; reasons.push('Low pressure'); }
  }

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, score));

  return { score, reasons };
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#166534'; // green-800
  if (score >= 55) return '#15803d'; // green-700
  if (score >= 40) return '#92400e'; // amber-800
  if (score >= 25) return '#c2410c'; // orange-700
  return '#991b1b';                  // red-800
}

function getScoreBg(score: number): string {
  if (score >= 75) return '#f0fdf4'; // green-50
  if (score >= 55) return '#fefce8'; // yellow-50
  if (score >= 40) return '#fffbeb'; // amber-50
  if (score >= 25) return '#fff7ed'; // orange-50
  return '#fef2f2';                  // red-50
}

export default async function ScorePage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr, zoom: zoomStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');
  const validZoom = parseZoomParam(zoomStr);

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  const [locationData, weatherResult] = await Promise.all([
    reverseGeocode(lat, lng),
    getCombinedForecast(lat, lng),
  ]);

  const { forecasts } = weatherResult;
  const hasOceanData = forecasts.some(f => f.waveHeight !== undefined);
  const timezone = getTimezone(lat, lng);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
    const parts = formatter.formatToParts(date);
    const weekday = parts.find(p => p.type === 'weekday')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    return `${weekday}. ${day}. ${hour}:${minute}`;
  };

  // Only keep hourly rows (gap between consecutive rows ≤ ~90 min)
  const hourlyForecasts: HourlyForecast[] = [];
  for (let i = 0; i < forecasts.length; i++) {
    if (i === 0) { hourlyForecasts.push(forecasts[i]); continue; }
    const gap = new Date(forecasts[i].time).getTime() - new Date(forecasts[i - 1].time).getTime();
    if (gap > 90 * 60_000) break;
    hourlyForecasts.push(forecasts[i]);
  }

  return (
    <div className="min-h-screen bg-ocean-50">
      <header className="bg-ocean-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton label="🎣 NoFish" />
          </div>
          <PageNav lat={lat} lng={lng} zoom={validZoom} current="score" availablePages={hasOceanData ? undefined : ['details']} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6 border-b border-gray-200 pb-4">
            {locationData && (
              <>
                <h2 className="text-2xl font-bold text-ocean-900 mb-1">
                  {locationData.name !== locationData.municipality
                    ? `${locationData.name}, ${locationData.municipality}`
                    : locationData.municipality}
                  {locationData.county && `, ${locationData.county}`}
                </h2>
              </>
            )}
            <p className="text-sm text-gray-500">
              {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'W'}
            </p>
          </div>

          {hourlyForecasts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No forecast data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" style={{ borderSpacing: '0.5rem 0', borderCollapse: 'separate' }}>
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                    <th className="pb-2">Time</th>
                    <th className="pb-2 text-center">Score</th>
                    <th className="pb-2">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {hourlyForecasts.map((forecast, i) => {
                    const { score, reasons } = computeFishingScore(forecast);
                    const isMidnight = i > 0 && (() => {
                      const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
                      return dateFmt.format(new Date(forecast.time)) !== dateFmt.format(new Date(hourlyForecasts[i - 1].time));
                    })();

                    const rows: React.ReactNode[] = [];
                    if (isMidnight) {
                      rows.push(
                        <tr key={`midnight-${forecast.time}`} aria-hidden="true">
                          <td colSpan={3} style={{ height: '3px', padding: 0, backgroundColor: '#d1d5db' }} />
                        </tr>
                      );
                    }

                    rows.push(
                      <tr key={forecast.time}>
                        <td className="py-2 text-sm font-medium tabular-nums whitespace-nowrap" style={getTimeColumnStyle(forecast.sunPhaseSegments)}>
                          {formatTime(forecast.time)}
                        </td>
                        <td className="py-2 text-center font-bold tabular-nums" style={{ color: getScoreColor(score), backgroundColor: getScoreBg(score) }}>
                          {score}%
                        </td>
                        <td className="py-2 text-xs text-gray-500">
                          {reasons.join(' · ') || '—'}
                        </td>
                      </tr>
                    );

                    return rows;
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-6">
            Source:{' '}
            <a
              href="https://www.met.no/en"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gray-600"
            >
              MET Norway
            </a>
          </p>

        </div>
      </main>

      <Footer />
    </div>
  );
}
