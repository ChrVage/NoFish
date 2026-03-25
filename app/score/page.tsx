import { notFound } from 'next/navigation';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { getTimezone } from '@/lib/utils/timezone';
import { parseZoomParam } from '@/lib/utils/params';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
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

// ── Fishing score — safety-first for a 21-ft boat ──────────────────────────
//
// The score starts at a base of 50 and is adjusted by comfort / fishing-quality
// factors.  On top of that, **safety caps** impose hard ceilings: no matter how
// good the other factors are, the score can never exceed the cap.  Multiple caps
// can apply; the lowest one wins.
//
// Safety caps address:
//   • Darkness  — ropes, debris, unlit objects in the water
//   • Waves     — a 21-ft boat cannot handle steep seas
//   • Gusts     — sudden wind shifts capsize small boats
//   • Wave+gust — the most dangerous interaction (wind-driven breaking waves)
//   • Sustained wind — small-craft advisory territory
//
type Reason = { text: string; tone: 'good' | 'bad' | 'danger' };

function computeFishingScore(f: HourlyForecast): { score: number; reasons: Reason[] } {
  let score = 50;
  const reasons: Reason[] = [];
  const good = (text: string) => reasons.push({ text, tone: 'good' });
  const bad  = (text: string) => reasons.push({ text, tone: 'bad' });
  const danger = (text: string) => reasons.push({ text, tone: 'danger' });
  let safetyCap = 100;

  const waves = f.waveHeight;
  const gusts = f.windGust;

  // ═══ SAFETY CAPS ═══════════════════════════════════════════════════════

  // ── Darkness: ropes, debris, unlit objects ─────────────────────────────
  let darkSafety = false;
  if (f.sunPhaseSegments && f.sunPhaseSegments.length > 0) {
    const dominant = f.sunPhaseSegments.reduce((a, b) => b.fraction > a.fraction ? b : a);
    if (dominant.phase === 'night') {
      safetyCap = Math.min(safetyCap, 5);
      danger('⚠️ Night — unsafe');
      darkSafety = true;
    } else if (dominant.phase === 'nautical') {
      safetyCap = Math.min(safetyCap, 15);
      danger('⚠️ Dark — poor visibility');
      darkSafety = true;
    }
  }

  // ── Wave height (21-ft boat limits) ───────────────────────────────────
  let waveSafety = false;
  if (waves !== undefined) {
    if (waves > 2.0) {
      safetyCap = Math.min(safetyCap, 5);
      danger('⚠️ Dangerous seas');
      waveSafety = true;
    } else if (waves > 1.5) {
      // Tolerable only in dead-calm wind (pure swell, no chop)
      if (gusts === undefined || gusts <= 5) {
        safetyCap = Math.min(safetyCap, 25);
        danger('⚠️ High waves');
      } else {
        safetyCap = Math.min(safetyCap, 10);
        danger('⚠️ High waves + wind');
      }
      waveSafety = true;
    } else if (waves > 1.0 && gusts !== undefined && gusts > 10) {
      safetyCap = Math.min(safetyCap, 15);
      danger('⚠️ Waves + gusts');
      waveSafety = true;
    }
  }

  // ── Extreme gusts — small-craft advisory ──────────────────────────────
  let gustSafety = false;
  if (gusts !== undefined) {
    if (gusts > 20) {
      safetyCap = Math.min(safetyCap, 5);
      danger('⚠️ Dangerous gusts');
      gustSafety = true;
    } else if (gusts > 15) {
      safetyCap = Math.min(safetyCap, 15);
      danger('⚠️ Strong gusts');
      gustSafety = true;
    }
  }

  // ── Sustained wind ────────────────────────────────────────────────────
  let windSafety = false;
  if (f.windSpeed !== undefined) {
    if (f.windSpeed > 15) {
      safetyCap = Math.min(safetyCap, 10);
      danger('⚠️ Storm wind');
      windSafety = true;
    } else if (f.windSpeed > 12) {
      safetyCap = Math.min(safetyCap, 25);
      danger('⚠️ Strong wind');
      windSafety = true;
    }
  }

  // ═══ FISHING QUALITY FACTORS ═══════════════════════════════════════════
  // Adjust the base score.  Safety caps will clamp the final result.

  // Wind (only when not already flagged as a safety issue)
  if (f.windSpeed !== undefined && !windSafety) {
    if (f.windSpeed <= 1) { score += 5; good('Calm wind'); }
    else if (f.windSpeed <= 5) { score += 10; good('Light wind'); }
    else if (f.windSpeed <= 8) { score += 3; good('Moderate breeze'); }
    else { score -= 8; bad('Moderate wind'); }
  }

  // Gusts (moderate — below safety threshold)
  if (gusts !== undefined && !gustSafety && gusts > 10) {
    score -= 5; bad('Gusty');
  }

  // Precipitation
  if (f.precipitation !== undefined) {
    if (f.precipitation === 0) { score += 5; good('Dry'); }
    else if (f.precipitation <= 0.5) { /* trace — neutral */ }
    else if (f.precipitation <= 2) { score -= 5; bad('Light rain'); }
    else { score -= 15; bad('Heavy rain'); }
  }

  // Wave comfort (only when not already flagged)
  if (waves !== undefined && !waveSafety) {
    if (waves <= 0.3) { score += 10; good('Calm seas'); }
    else if (waves <= 0.7) { score += 5; good('Low waves'); }
    else if (waves <= 1.0) { /* neutral */ }
    else { score -= 10; bad('Choppy'); }
  }

  // Cloud cover
  if (f.cloudCover !== undefined) {
    if (f.cloudCover >= 50 && f.cloudCover <= 90) { score += 5; good('Overcast'); }
    else if (f.cloudCover < 20) { score -= 3; bad('Clear sky'); }
  }

  // Tide phase
  if (f.tidePhase) {
    const tp = f.tidePhase.toLowerCase();
    if (tp.includes('hi') || tp.includes('lo')) {
      if (tp.match(/^(hi|lo)$/i) || tp.includes('(')) {
        score -= 5; bad('Slack tide');
      } else {
        score += 8; good('Tide turning');
      }
    } else if (tp.includes('rising') || tp.includes('falling')) {
      score += 10; good('Moving tide');
    }
  }

  // Sun phase — fishing quality (darkness already capped above)
  if (f.sunPhaseSegments && f.sunPhaseSegments.length > 0 && !darkSafety) {
    const dominant = f.sunPhaseSegments.reduce((a, b) => b.fraction > a.fraction ? b : a);
    if (dominant.phase === 'day') {
      const hasCivil = f.sunPhaseSegments.some(s => s.phase === 'civil' && s.fraction > 0.1);
      if (hasCivil) { score += 10; good('Dawn/dusk'); }
      else { score += 5; good('Daylight'); }
    } else if (dominant.phase === 'civil') {
      score += 10; good('Twilight');
    }
  }

  // Pressure
  if (f.pressure !== undefined) {
    if (f.pressure >= 1015 && f.pressure <= 1030) { score += 3; }
    else if (f.pressure < 1000) { score -= 5; bad('Low pressure'); }
  }

  // Clamp base score, then apply safety cap
  score = Math.max(0, Math.min(100, score));
  score = Math.min(score, safetyCap);

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
                        <td className="py-2 text-xs">
                          {reasons.length === 0 ? '—' : reasons.map((r, j) => (
                            <span key={j}>
                              {j > 0 && <span className="text-gray-300"> · </span>}
                              <span style={{ color: r.tone === 'danger' ? '#991b1b' : r.tone === 'bad' ? '#c2410c' : '#15803d' }}>
                                {r.text}
                              </span>
                            </span>
                          ))}
                        </td>
                      </tr>
                    );

                    return rows;
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }} className="mt-6">
            <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden' }}>
              <a
                href="https://github.com/ChrVage/NoFish/blob/main/readme-score.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937', borderRight: '2px solid white' }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>About Fishing Score</span>
              </a>
              <a
                href="https://github.com/ChrVage/NoFish/blob/main/README.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937', borderRight: '2px solid white' }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>About NoFish</span>
              </a>
              <a
                href="https://github.com/ChrVage/NoFish/issues/new/choose"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937' }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Feedback</span>
              </a>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
