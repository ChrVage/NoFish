import { notFound } from 'next/navigation';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { getTimezone } from '@/lib/utils/timezone';
import { parseZoomParam } from '@/lib/utils/params';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import { enrichForecasts } from '@/lib/utils/enrichForecasts';
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

// ── Deep-water fishing score — Norwegian coast, 50–200 m depth ─────────────
//
// The score uses continuous mathematical functions (Gaussian curves, sigmoids)
// to produce a smooth 0–100 % gauge.
//
//   0 % = most dangerous / completely unfishable
// 100 % = perfect conditions, fish guaranteed
//
// The algorithm is designed for exposed Norwegian coastal waters where the
// Norwegian Coastal Current (NCC) often dominates tidal flow. "No current,
// no fish" is the core philosophy — water movement is the primary driver for
// deep-water predators (Ling, Tusk, Cod, Saithe).
//
// Variables (multiplied together as 0–1 factors, then scaled to 0–100):
//   1. Current speed   – Gaussian peak at 0.4 m/s (the base score)
//   2. Wind & drift    – safety override + wind-current interaction
//   3. Tide phase      – biological modifier (mid-tide > turning > slack)
//   4. Moon phase      – tidal amplitude modifier (spring > neap)
//   5. Light & temp    – dawn/dusk peak, darkness penalty, temp stability
//   6. Wave height     – gear-handling & safety
//

type Reason = { text: string; tone: 'good' | 'bad' | 'danger' };

// ── Continuous helper functions ──────────────────────────────────────────────

/** Gaussian bell curve centred at `mu` with standard deviation `sigma`, peak = 1. */
function gaussian(x: number, mu: number, sigma: number): number {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

/** Smooth sigmoid mapping: returns 0→1 as x goes from x0 to x1. */
function sigmoid01(x: number, x0: number, x1: number): number {
  const t = (x - x0) / (x1 - x0);
  const clamped = Math.max(0, Math.min(1, t));
  // Smoothstep
  return clamped * clamped * (3 - 2 * clamped);
}

/** Linear interpolation clamped to [0, 1]. */
function lerp01(x: number, x0: number, x1: number): number {
  return Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
}

// ── Moon phase age helper ───────────────────────────────────────────────────
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_DAYS = 29.53058770576;

function moonAge(date: Date): number {
  const days = (date.getTime() - NEW_MOON_EPOCH_MS) / 86_400_000;
  return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
}

// ── The scoring function ────────────────────────────────────────────────────

function computeFishingScore(f: HourlyForecast): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const good   = (text: string) => reasons.push({ text, tone: 'good' });
  const bad    = (text: string) => reasons.push({ text, tone: 'bad' });
  const danger = (text: string) => reasons.push({ text, tone: 'danger' });

  // ═══ 1. CURRENT SPEED — base score (Gaussian, peak at 0.4 m/s) ═══════
  //
  //   0.0 m/s → ~0.2  ("dead water")
  //   0.3–0.5 → ~1.0  (sweet spot)
  //   0.7     → ~0.7
  //   1.0     → ~0.2
  //   1.5+    → ~0.0
  //
  let currentFactor = 0.5; // default when no current data (neutral)
  if (f.currentSpeed !== undefined) {
    const cs = f.currentSpeed;
    // Gaussian centred at 0.4 m/s, σ = 0.22
    currentFactor = gaussian(cs, 0.40, 0.22);
    // Floor for dead water (< 0.1 m/s → max 0.15)
    if (cs < 0.1) currentFactor = Math.min(currentFactor, 0.15);
    // Rapid drop above 1.0 m/s
    if (cs > 1.0) currentFactor *= Math.max(0, 1 - (cs - 1.0) / 0.5);

    if (cs >= 0.25 && cs <= 0.55) good(`Current ${cs.toFixed(2)} m/s — sweet spot`);
    else if (cs < 0.15) bad(`Current ${cs.toFixed(2)} m/s — dead water`);
    else if (cs > 1.0) danger(`⚠️ Current ${cs.toFixed(2)} m/s — unfishable`);
    else if (cs > 0.7) bad(`Current ${cs.toFixed(2)} m/s — gear drag`);
    else if (cs < 0.25) bad(`Current ${cs.toFixed(2)} m/s — slow`);
    else good(`Current ${cs.toFixed(2)} m/s`);
  }

  // ═══ 2. WIND & DRIFT — safety + wind-current interaction ═════════════
  //
  //   > 15 m/s sustained → danger override → factor → 0
  //   > 12 m/s           → factor < 0.15
  //   Wind opposing current → positive (slows drift, holds bottom)
  //   Wind aligned with current → negative (too much drift)
  //
  let windFactor = 0.85; // default (light / no data)
  if (f.windSpeed !== undefined) {
    const ws = f.windSpeed;
    const gs = f.windGust ?? ws;

    // Gale / storm override
    if (ws > 15 || gs > 22) {
      windFactor = 0;
      danger(`⚠️ Storm — ${ws.toFixed(1)} m/s (gusts ${gs.toFixed(1)})`);
    } else if (ws > 12 || gs > 18) {
      windFactor = lerp01(Math.max(ws, gs * 0.7), 12, 16) * -1 + 1; // 1→0 over 12–16
      windFactor = Math.max(windFactor, 0.05);
      danger(`⚠️ Strong wind ${ws.toFixed(1)} m/s`);
    } else {
      // Base wind curve: gentle penalty increasing from 0 m/s upward
      // 0–3 m/s ideal (factor ~0.95), 8 m/s → ~0.7, 12 m/s → ~0.35
      windFactor = 1 - 0.05 * ws + 0.001 * ws; // simplified linear
      windFactor = Math.max(0.25, Math.min(1, 1 - 0.055 * ws));

      // Wind-current interaction modifier
      if (f.currentDirection !== undefined && f.windDirection !== undefined && f.currentSpeed !== undefined && f.currentSpeed > 0.1) {
        // windDirection is "from", currentDirection is "to"
        // Wind blowing into the current = opposing = good
        const windTo = (f.windDirection + 180) % 360;
        let angleDiff = Math.abs(windTo - f.currentDirection);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;

        if (angleDiff > 120) {
          // Wind opposing current — excellent for drift control
          const bonus = 0.1 * (ws / 8); // stronger wind = bigger benefit (up to a point)
          windFactor = Math.min(1, windFactor + Math.min(bonus, 0.15));
          good('Wind opposing current');
        } else if (angleDiff < 60 && ws > 5) {
          // Wind aligned with current — bad drift
          const penalty = 0.1 * (ws / 8);
          windFactor = Math.max(0.15, windFactor - penalty);
          bad('Wind aligned with current');
        }
      }

      if (ws <= 3) good(`Light wind ${ws.toFixed(1)} m/s`);
      else if (ws <= 7) { /* neutral */ }
      else bad(`Wind ${ws.toFixed(1)} m/s`);

      // Gust penalty (moderate)
      if (gs > 12) {
        windFactor *= 0.85;
        bad(`Gusts ${gs.toFixed(1)} m/s`);
      } else if (gs > 10) {
        windFactor *= 0.92;
      }
    }
  }

  // ═══ 3. TIDE PHASE — biological modifier ═════════════════════════════
  //
  //   Mid-tide (Rising/Falling)  → 1.0  (peak nutrient exchange)
  //   Rising tide                → extra +0.05 (increased hydrostatic pressure)
  //   Turning (±1h, ±2h)        → 0.7–0.85
  //   Slack (exact Hi/Lo)       → 0.55
  //
  let tideFactor = 0.75; // default when no tide data
  if (f.tidePhase) {
    const tp = f.tidePhase.toLowerCase();
    if (tp.includes('rising')) {
      tideFactor = 1.0;
      good('Rising tide — fish active');
    } else if (tp.includes('falling')) {
      tideFactor = 0.95;
      good('Falling tide');
    } else if (tp.match(/[+-]1h/)) {
      tideFactor = 0.85;
      good('Tide turning');
    } else if (tp.match(/[+-]2h/)) {
      tideFactor = 0.75;
      // neutral, no label
    } else if (tp.match(/^(hi|lo)\b/i) || tp.includes('(')) {
      // Exact high/low = slack
      tideFactor = 0.55;
      bad('Slack tide');
    } else {
      tideFactor = 0.80;
    }
  }

  // ═══ 4. MOON PHASE — tidal amplitude modifier ════════════════════════
  //
  //   New/Full Moon (spring tides) → 1.0  (strongest deep-water pull)
  //   First/Last Quarter (neap)   → 0.82 (weaker tidal movement)
  //   Continuous cosine curve between them
  //
  let moonFactor = 0.90; // default
  const entryDate = new Date(f.time);
  if (f.moonPhase) {
    const age = moonAge(entryDate);
    // cos peaks at 0 (new moon) and π (full moon ≈ 14.77 days)
    // Map: 0/29.5 days = new moon, 14.77 = full moon, 7.4/22.1 = quarter
    const phase = (age / SYNODIC_DAYS) * 2 * Math.PI;
    // cos(2*phase) peaks at new & full moon, troughs at quarters
    moonFactor = 0.82 + 0.18 * (0.5 + 0.5 * Math.cos(2 * phase));

    if (f.moonPhase.includes('New Moon') || f.moonPhase.includes('Full Moon')) {
      good('Spring tide (strong pull)');
    } else if (f.moonPhase.includes('Quarter')) {
      bad('Neap tide (weak pull)');
    }
  }

  // ═══ 5. LIGHT — dawn/dusk peak, darkness safety ══════════════════════
  //
  //   Dawn/Dusk (civil twilight fraction > 10%)  → 1.0 (peak feeding)
  //   Full daylight                              → 0.80
  //   Bright midday + clear sky                  → 0.70
  //   Nautical twilight                          → 0.25 (dangerous)
  //   Night                                      → 0.0  (unsafe)
  //
  let lightFactor = 0.80; // default daylight
  if (f.sunPhaseSegments && f.sunPhaseSegments.length > 0) {
    const dominant = f.sunPhaseSegments.reduce((a, b) => b.fraction > a.fraction ? b : a);
    const nightFrac = f.sunPhaseSegments.filter(s => s.phase === 'night').reduce((sum, s) => sum + s.fraction, 0);
    const nautFrac = f.sunPhaseSegments.filter(s => s.phase === 'nautical').reduce((sum, s) => sum + s.fraction, 0);
    const civilFrac = f.sunPhaseSegments.filter(s => s.phase === 'civil').reduce((sum, s) => sum + s.fraction, 0);
    const dayFrac = f.sunPhaseSegments.filter(s => s.phase === 'day').reduce((sum, s) => sum + s.fraction, 0);

    if (dominant.phase === 'night') {
      lightFactor = 0.0;
      danger('⚠️ Night — unsafe');
    } else if (dominant.phase === 'nautical') {
      lightFactor = nightFrac > 0.1 ? 0.08 : 0.20;
      danger('⚠️ Dark — poor visibility');
    } else if (dominant.phase === 'civil') {
      // Civil twilight = prime time for deep-water fish
      lightFactor = 1.0;
      good('Twilight — peak feeding');
    } else if (dominant.phase === 'day') {
      if (civilFrac > 0.1) {
        lightFactor = 1.0;
        good('Dawn/dusk');
      } else {
        lightFactor = 0.80;
        // Bright midday with clear sky → slight penalty
        if (f.cloudCover !== undefined && f.cloudCover < 20) {
          lightFactor = 0.70;
          bad('Bright sun');
        } else if (f.cloudCover !== undefined && f.cloudCover >= 50) {
          lightFactor = 0.85;
          good('Overcast');
        }
      }
    }
  }

  // ═══ 6. WAVE HEIGHT — gear handling & safety ══════════════════════════
  //
  //   ≤ 0.5 m  → 1.0
  //   1.0 m    → ~0.8
  //   1.5 m    → ~0.4
  //   2.0 m    → ~0.1
  //   > 2.5 m  → 0.0 (danger)
  //
  let waveFactor = 0.90; // default when no wave data
  if (f.waveHeight !== undefined) {
    const wh = f.waveHeight;
    if (wh <= 0.5) {
      waveFactor = 1.0;
      good('Calm seas');
    } else if (wh <= 1.0) {
      waveFactor = 1.0 - 0.4 * sigmoid01(wh, 0.5, 1.0);
      if (wh <= 0.7) good('Low waves');
    } else if (wh <= 2.0) {
      waveFactor = 0.6 - 0.5 * sigmoid01(wh, 1.0, 2.0);
      if (wh > 1.5) {
        const gustVal = f.windGust ?? f.windSpeed ?? 0;
        if (gustVal > 5) {
          waveFactor *= 0.5;
          danger(`⚠️ Waves ${wh.toFixed(1)}m + wind`);
        } else {
          bad(`Waves ${wh.toFixed(1)}m`);
        }
      } else {
        bad(`Waves ${wh.toFixed(1)}m`);
      }
    } else {
      waveFactor = Math.max(0, 0.1 - 0.1 * sigmoid01(wh, 2.0, 3.0));
      danger(`⚠️ Dangerous seas ${wh.toFixed(1)}m`);
    }
  }

  // ═══ 7. PRECIPITATION (minor modifier) ════════════════════════════════
  let precipFactor = 1.0;
  if (f.precipitation !== undefined) {
    if (f.precipitation > 2) {
      precipFactor = 0.85;
      bad('Heavy rain');
    } else if (f.precipitation > 0.5) {
      precipFactor = 0.93;
    }
    // Light / no rain: neutral (1.0)
  }

  // ═══ 8. SEA TEMPERATURE stability (minor modifier) ════════════════════
  let tempFactor = 1.0;
  if (f.seaTemperature !== undefined) {
    // Very cold water (< 3°C) slightly negative for activity
    if (f.seaTemperature < 3) {
      tempFactor = 0.92;
      bad('Cold sea');
    }
    // No per-hour trend data available, so we only flag extremes
  }

  // ═══ COMBINE — multiply factors, scale to 0–100 ══════════════════════
  const raw = currentFactor * windFactor * tideFactor * moonFactor * lightFactor * waveFactor * precipFactor * tempFactor;
  const score = Math.round(Math.max(0, Math.min(100, raw * 100)));

  return { score, reasons };
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#166534'; // green-800
  if (score >= 50) return '#15803d'; // green-700
  if (score >= 35) return '#92400e'; // amber-800
  if (score >= 20) return '#c2410c'; // orange-700
  return '#991b1b';                  // red-800
}

function getScoreBg(score: number): string {
  if (score >= 70) return '#f0fdf4'; // green-50
  if (score >= 50) return '#fefce8'; // yellow-50
  if (score >= 35) return '#fffbeb'; // amber-50
  if (score >= 20) return '#fff7ed'; // orange-50
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

  const { forecasts: rawForecasts } = weatherResult;
  const forecasts = enrichForecasts(rawForecasts);
  const hasOceanData = forecasts.some(f => f.waveHeight !== undefined);
  const timezone = getTimezone(lat, lng);

  // Pre-compute scores for all forecasts
  const scoredForecasts = forecasts.map(f => ({ forecast: f, ...computeFishingScore(f) }));

  // Find best fishing windows (1-3 hours, adaptive based on score variability)
  // Try all windows of length 1-3. Pick the longest whose average is within
  // 5 points of the overall best average (prefer longer consistent windows).
  // Return top 2 non-overlapping windows.
  type Window = { start: number; len: number; avg: number };
  const bestWindows: Window[] = [];
  if (scoredForecasts.length > 0) {
    let topAvg = -1;
    const candidates: Window[] = [];
    for (let len = 1; len <= 3; len++) {
      for (let i = 0; i <= scoredForecasts.length - len; i++) {
        let sum = 0;
        for (let j = 0; j < len; j++) sum += scoredForecasts[i + j].score;
        const avg = sum / len;
        candidates.push({ start: i, len, avg });
        if (avg > topAvg) topAvg = avg;
      }
    }
    // Among windows within 5 points of the best, pick the longest (then highest avg)
    const viable = candidates
      .filter(c => c.avg >= topAvg - 5)
      .sort((a, b) => b.len - a.len || b.avg - a.avg);
    for (const c of viable) {
      const overlaps = bestWindows.some(w =>
        c.start < w.start + w.len && c.start + c.len > w.start
      );
      if (!overlaps) {
        bestWindows.push(c);
        if (bestWindows.length === 2) break;
      }
    }
    // Sort by time
    bestWindows.sort((a, b) => a.start - b.start);
  }

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
            {bestWindows.length > 0 && (() => {
              const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone });
              const timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone });
              const locationName = locationData
                ? (locationData.name !== locationData.municipality
                    ? `${locationData.name}, ${locationData.municipality}`
                    : locationData.municipality)
                : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
              const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
              const icsDateFmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

              const buildIcs = (w: (typeof bestWindows)[0]) => {
                const hours = [];
                for (let j = 0; j < w.len; j++) hours.push(scoredForecasts[w.start + j]);
                const start = new Date(hours[0].forecast.time);
                const last = new Date(hours[hours.length - 1].forecast.time);
                const end = new Date(last.getTime() + 3600000);
                const avg = Math.round(w.avg);

                // Build weather description from hourly data
                const lines: string[] = [`NoFish score: ${avg}%`, ''];
                for (const h of hours) {
                  const f = h.forecast;
                  const t = timeFmt.format(new Date(f.time));
                  const parts: string[] = [`Score: ${h.score}%`];
                  if (f.windSpeed !== undefined) parts.push(`Wind: ${f.windSpeed.toFixed(1)} m/s${f.windGust ? ` (gust ${f.windGust.toFixed(1)})` : ''}${f.windDirection !== undefined ? ` from ${f.windDirection}°` : ''}`);
                  if (f.waveHeight !== undefined) parts.push(`Waves: ${f.waveHeight.toFixed(1)} m${f.waveDirection !== undefined ? ` from ${f.waveDirection}°` : ''}`);
                  if (f.currentSpeed !== undefined) parts.push(`Current: ${f.currentSpeed.toFixed(2)} m/s${f.currentDirection !== undefined ? ` toward ${f.currentDirection}°` : ''}`);
                  if (f.temperature !== undefined) parts.push(`Air: ${f.temperature.toFixed(1)}°C`);
                  if (f.seaTemperature !== undefined) parts.push(`Sea: ${f.seaTemperature.toFixed(1)}°C`);
                  if (f.precipitation !== undefined && f.precipitation > 0) parts.push(`Precip: ${f.precipitation.toFixed(1)} mm`);
                  if (f.cloudCover !== undefined) parts.push(`Cloud: ${f.cloudCover}%`);
                  if (f.pressure !== undefined) parts.push(`Pressure: ${f.pressure.toFixed(0)} hPa`);
                  if (f.humidity !== undefined) parts.push(`Humidity: ${f.humidity}%`);
                  if (f.tidePhase) parts.push(`Tide: ${f.tidePhase}`);
                  if (f.moonPhase) parts.push(`Moon: ${f.moonPhase}`);
                  if (f.sunPhase) parts.push(`Sun: ${f.sunPhase}`);
                  lines.push(`${t}:  ${parts.join(' | ')}`);
                }
                const desc = lines.join('\\n');

                const ics = [
                  'BEGIN:VCALENDAR',
                  'VERSION:2.0',
                  'PRODID:-//NoFish//Score//EN',
                  'BEGIN:VEVENT',
                  `DTSTART:${icsDateFmt(start)}`,
                  `DTEND:${icsDateFmt(end)}`,
                  `SUMMARY:🎣 Fishing ${avg}% – ${locationName}`,
                  `DESCRIPTION:${desc}`,
                  `LOCATION:${mapsUrl}`,
                  `GEO:${lat};${lng}`,
                  `URL:${mapsUrl}`,
                  `UID:nofish-${start.getTime()}@nofish`,
                  'END:VEVENT',
                  'END:VCALENDAR',
                ].join('\r\n');
                return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
              };

              return (
                <div className="mt-3">
                  <h3 className="text-sm font-bold text-ocean-900">Best fishing windows:</h3>
                  <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
                    <tbody>
                      {bestWindows.map((w, idx) => {
                        const startDate = new Date(scoredForecasts[w.start].forecast.time);
                        const lastDate = new Date(scoredForecasts[w.start + w.len - 1].forecast.time);
                        const endHour = new Date(lastDate.getTime() + 3600000);
                        const avg = Math.round(w.avg);
                        const icsHref = buildIcs(w);
                        return (
                          <tr key={idx}>
                            <td className="py-0.5 pr-8">
                              <span
                                className="inline-block w-11 text-center font-bold rounded px-1.5 py-0.5 text-xs"
                                style={{ color: getScoreColor(avg), backgroundColor: getScoreBg(avg) }}
                              >
                                {avg}%
                              </span>
                            </td>
                            <td className="py-0.5 pr-8 text-ocean-800 font-medium whitespace-nowrap">
                              {dateFmt.format(startDate)}{' '}
                              {timeFmt.format(startDate)}–{timeFmt.format(endHour)}
                            </td>
                            <td className="py-0.5">
                              <a
                                href={icsHref}
                                download={`fishing-${idx + 1}.ics`}
                                className="inline-flex items-center gap-0.5 text-xs text-ocean-600 hover:text-ocean-800"
                                title="Add to calendar"
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                .ics
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {forecasts.length === 0 ? (
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
                  {scoredForecasts.map(({ forecast, score, reasons }, i) => {
                    const isMidnight = i > 0 && (() => {
                      const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
                      return dateFmt.format(new Date(forecast.time)) !== dateFmt.format(new Date(scoredForecasts[i - 1].forecast.time));
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
