/**
 * Deep-water fishing score — Norwegian coast, 50–200 m depth
 *
 * The score uses continuous mathematical functions (Gaussian curves, sigmoids)
 * to produce a smooth 0–100 % gauge.
 *
 *   0 % = most dangerous / completely unfishable
 * 100 % = perfect conditions, fish guaranteed
 *
 * The algorithm is designed for exposed Norwegian coastal waters where the
 * Norwegian Coastal Current (NCC) often dominates tidal flow. "No current,
 * no fish" is the core philosophy — water movement is the primary driver for
 * deep-water predators (Ling, Tusk, Cod, Saithe).
 *
 * Variables (multiplied together as 0–1 factors, then scaled to 0–100):
 *   1. Current speed   – Gaussian peak at 0.4 m/s (the base score)
 *   2. Wind & drift    – safety override + wind-current interaction
 *   3. Tide phase      – biological modifier (mid-tide > turning > slack)
 *   4. Moon phase      – tidal amplitude modifier (spring > neap)
 *   5. Light & temp    – dawn/dusk peak, darkness penalty, temp stability
 *   6. Wave height     – gear-handling & safety
 *   7. Precipitation   – minor modifier
 *   8. Sea temperature – minor modifier
 *   9. Barometric pressure – fish activity modifier (fishing)
 *  10. Wave period     – steep chop penalty (safety)
 */

import type { HourlyForecast } from '@/types/weather';

// ── Public types ────────────────────────────────────────────────────────────

export type Reason = { text: string; tone: 'good' | 'bad' | 'danger'; category: 'safety' | 'fishing' };

export interface ScoredForecast {
  forecast: HourlyForecast;
  score: number;
  safetyScore: number;
  fishingScore: number;
  reasons: Reason[];
}

export interface BestWindow {
  start: number;
  len: number;
  avg: number;
}

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

export function computeFishingScore(f: HourlyForecast): { score: number; safetyScore: number; fishingScore: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const good   = (text: string, category: 'safety' | 'fishing') => reasons.push({ text, tone: 'good', category });
  const bad    = (text: string, category: 'safety' | 'fishing') => reasons.push({ text, tone: 'bad', category });
  const danger = (text: string, category: 'safety' | 'fishing') => reasons.push({ text, tone: 'danger', category });

  // ═══ 1. CURRENT SPEED — base score (Gaussian, peak at 0.4 m/s) ═══════
  //
  //   0.0 m/s → ~0.2  ("dead water")
  //   0.3–0.5 → ~1.0  (sweet spot)
  //   0.7     → ~0.7
  //   1.0     → ~0.2
  //   1.5+    → ~0.0
  //
  let currentFactor = 1.0; // default when no current data (skip — no effect)
  if (f.currentSpeed !== undefined) {
    const cs = f.currentSpeed;
    // Gaussian centred at 0.4 m/s, σ = 0.22
    currentFactor = gaussian(cs, 0.40, 0.22);
    // Floor for dead water (< 0.1 m/s → max 0.15)
    if (cs < 0.1) currentFactor = Math.min(currentFactor, 0.15);
    // Rapid drop above 1.0 m/s
    if (cs > 1.0) currentFactor *= Math.max(0, 1 - (cs - 1.0) / 0.5);

    if (cs >= 0.25 && cs <= 0.55) good(`Current ${cs.toFixed(2)} m/s — sweet spot`, 'fishing');
    else if (cs < 0.15) bad(`Current ${cs.toFixed(2)} m/s — dead water`, 'fishing');
    else if (cs > 1.0) danger(`⚠️ Current ${cs.toFixed(2)} m/s — unfishable`, 'fishing');
    else if (cs > 0.7) bad(`Current ${cs.toFixed(2)} m/s — gear drag`, 'fishing');
    else if (cs < 0.25) bad(`Current ${cs.toFixed(2)} m/s — slow`, 'fishing');
    else good(`Current ${cs.toFixed(2)} m/s`, 'fishing');
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
      danger(`⚠️ Storm — ${ws.toFixed(1)} m/s (gusts ${gs.toFixed(1)})`, 'safety');
    } else if (ws > 12 || gs > 18) {
      // 12 m/s → 0.20, 13.5 m/s → 0.10, 15 m/s → 0.05
      windFactor = (1 - lerp01(Math.max(ws, gs * 0.7), 12, 15)) * 0.20;
      windFactor = Math.max(windFactor, 0.05);
      danger(`⚠️ Strong wind ${ws.toFixed(1)} m/s`, 'safety');
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
          good('Wind opposing current', 'safety');
        } else if (angleDiff < 60 && ws > 5) {
          // Wind aligned with current — bad drift
          const penalty = 0.1 * (ws / 8);
          windFactor = Math.max(0.15, windFactor - penalty);
          bad('Wind aligned with current', 'safety');
        }
      }

      if (ws <= 3) good(`Light wind ${ws.toFixed(1)} m/s`, 'safety');
      else if (ws <= 7) { /* neutral */ }
      else bad(`Wind ${ws.toFixed(1)} m/s`, 'safety');

      // Gust penalty
      if (ws >= 10 && gs > 15) {
        // Sustained strong wind + heavy gusts — harsh conditions
        windFactor *= 0.55;
        danger(`⚠️ Sustained ${ws.toFixed(1)} m/s with gusts ${gs.toFixed(1)} m/s`, 'safety');
      } else if (gs > 12) {
        windFactor *= 0.85;
        bad(`Gusts ${gs.toFixed(1)} m/s`, 'safety');
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
      good('Rising tide — fish active', 'fishing');
    } else if (tp.includes('falling')) {
      tideFactor = 0.95;
      good('Falling tide', 'fishing');
    } else if (tp.match(/[+-]1h/)) {
      tideFactor = 0.85;
      good('Tide turning', 'fishing');
    } else if (tp.match(/[+-]2h/)) {
      tideFactor = 0.75;
      // neutral, no label
    } else if (tp.match(/^(hi|lo)\b/i) || tp.includes('(')) {
      // Exact high/low = slack
      tideFactor = 0.55;
      bad('Slack tide', 'fishing');
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
      good('Spring tide (strong pull)', 'fishing');
    } else if (f.moonPhase.includes('Quarter')) {
      bad('Neap tide (weak pull)', 'fishing');
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
    const civilFrac = f.sunPhaseSegments.filter(s => s.phase === 'civil').reduce((sum, s) => sum + s.fraction, 0);

    if (dominant.phase === 'night') {
      lightFactor = 0.0;
      danger('⚠️ Night — unsafe', 'safety');
      danger('⚠️ Night — no feeding', 'fishing');
    } else if (dominant.phase === 'nautical') {
      lightFactor = nightFrac > 0.1 ? 0.08 : 0.20;
      danger('⚠️ Dark — poor visibility', 'safety');
      bad('Dark — low activity', 'fishing');
    } else if (dominant.phase === 'civil') {
      // Civil twilight = prime time for deep-water fish
      lightFactor = 1.0;
      good('Good visibility', 'safety');
      good('Twilight — peak feeding', 'fishing');
    } else if (dominant.phase === 'day') {
      if (civilFrac > 0.1) {
        lightFactor = 1.0;
        good('Good visibility', 'safety');
        good('Dawn/dusk — active feeding', 'fishing');
      } else {
        lightFactor = 0.80;
        // Bright midday with clear sky → slight penalty
        if (f.cloudCover !== undefined && f.cloudCover < 20) {
          lightFactor = 0.70;
          good('Clear sky', 'safety');
          bad('Bright sun — fish deep', 'fishing');
        } else if (f.cloudCover !== undefined && f.cloudCover >= 50) {
          lightFactor = 0.85;
          good('Overcast', 'safety');
          good('Overcast — fish active', 'fishing');
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
      good('Calm seas', 'safety');
    } else if (wh <= 1.0) {
      waveFactor = 1.0 - 0.4 * sigmoid01(wh, 0.5, 1.0);
      if (wh <= 0.7) good('Low waves', 'safety');
    } else if (wh <= 2.0) {
      waveFactor = 0.6 - 0.5 * sigmoid01(wh, 1.0, 2.0);
      if (wh > 1.5) {
        const gustVal = f.windGust ?? f.windSpeed ?? 0;
        if (gustVal > 5) {
          waveFactor *= 0.5;
          danger(`⚠️ Waves ${wh.toFixed(1)}m + wind`, 'safety');
        } else {
          bad(`Waves ${wh.toFixed(1)}m`, 'safety');
        }
      } else {
        bad(`Waves ${wh.toFixed(1)}m`, 'safety');
      }
    } else {
      waveFactor = Math.max(0, 0.1 - 0.1 * sigmoid01(wh, 2.0, 3.0));
      danger(`⚠️ Dangerous seas ${wh.toFixed(1)}m`, 'safety');
    }
  }

  // ═══ 7. PRECIPITATION (minor modifier) ════════════════════════════════
  let precipFactor = 1.0;
  if (f.precipitation !== undefined) {
    if (f.precipitation > 2) {
      precipFactor = 0.85;
      bad('Heavy rain', 'fishing');
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
      bad('Cold sea', 'fishing');
    }
    // No per-hour trend data available, so we only flag extremes
  }

  // ═══ 9. BAROMETRIC PRESSURE — fish activity modifier (fishing) ════════
  //
  //   Stable / slowly falling pressure is best for fishing.
  //   Without trend data, we score based on absolute value:
  //     1010–1020 hPa → ideal (moderate low, fish active)
  //     1000–1010     → good (approaching low)
  //     1020–1030     → slight penalty (high pressure, fish sluggish)
  //     < 1000        → storm proximity, but fish may feed frenetically
  //     > 1030        → strong high, fish inactive
  //
  let pressureFactor = 1.0;
  if (f.pressure !== undefined) {
    const p = f.pressure;
    if (p >= 1010 && p <= 1020) {
      pressureFactor = 1.0;
      good('Ideal pressure', 'fishing');
    } else if (p >= 1000 && p < 1010) {
      pressureFactor = 0.95;
      good('Low pressure — fish active', 'fishing');
    } else if (p > 1020 && p <= 1030) {
      pressureFactor = 0.90;
      bad('High pressure', 'fishing');
    } else if (p < 1000) {
      // Very low — storm-adjacent, fish may feed before front
      pressureFactor = 0.88;
      bad(`Low pressure ${p.toFixed(0)} hPa`, 'fishing');
    } else {
      // > 1030 hPa — strong stable high
      pressureFactor = 0.82;
      bad(`Strong high ${p.toFixed(0)} hPa — fish inactive`, 'fishing');
    }
  }

  // ═══ 10. WAVE PERIOD — safety modifier ════════════════════════════════
  //
  //   Longer wave period = more spread-out swell = safer & more comfortable.
  //   Short steep waves are dangerous and make gear handling very difficult.
  //     ≥ 10 s  → 1.0  (long comfortable swell)
  //     7–10 s  → 0.85–1.0 (moderate)
  //     5–7 s   → 0.6–0.85 (short, uncomfortable)
  //     < 5 s   → 0.3–0.6 (steep, dangerous chop)
  //   Only applies when there are meaningful waves (> 0.5 m).
  //
  let wavePeriodFactor = 1.0; // default when no data or calm seas
  if (f.wavePeriod !== undefined && f.waveHeight !== undefined && f.waveHeight > 0.5) {
    const wp = f.wavePeriod;
    if (wp >= 10) {
      wavePeriodFactor = 1.0;
      good('Long swell — comfortable', 'safety');
    } else if (wp >= 7) {
      wavePeriodFactor = 0.85 + 0.15 * lerp01(wp, 7, 10);
      // neutral — no reason unless notable
    } else if (wp >= 5) {
      wavePeriodFactor = 0.60 + 0.25 * lerp01(wp, 5, 7);
      bad(`Short waves ${wp.toFixed(1)}s`, 'safety');
    } else {
      wavePeriodFactor = 0.30 + 0.30 * lerp01(wp, 3, 5);
      danger(`⚠️ Steep chop ${wp.toFixed(1)}s`, 'safety');
    }
  }

  // ═══ COMBINE — multiply factors, scale to 0–100 ══════════════════════
  const safetyRaw = windFactor * waveFactor * lightFactor * wavePeriodFactor;
  const fishingRaw = currentFactor * tideFactor * moonFactor * precipFactor * tempFactor * pressureFactor;
  const raw = safetyRaw * fishingRaw;
  const score = Math.round(Math.max(0, Math.min(100, raw * 100)));
  const safetyScore = Math.round(Math.max(0, Math.min(100, safetyRaw * 100)));
  const fishingScore = Math.round(Math.max(0, Math.min(100, fishingRaw * 100)));

  return { score, safetyScore, fishingScore, reasons };
}

// ── Score display helpers ───────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 70) return '#166534'; // green-800
  if (score >= 50) return '#15803d'; // green-700
  if (score >= 35) return '#92400e'; // amber-800
  if (score >= 20) return '#c2410c'; // orange-700
  return '#991b1b';                  // red-800
}

export function getScoreBg(score: number): string {
  if (score >= 70) return '#f0fdf4'; // green-50
  if (score >= 50) return '#fefce8'; // yellow-50
  if (score >= 35) return '#fffbeb'; // amber-50
  if (score >= 20) return '#fff7ed'; // orange-50
  return '#fef2f2';                  // red-50
}

// ── Best fishing window finder ──────────────────────────────────────────────

/**
 * Find best fishing windows (1–3 hours) from a list of scored forecasts.
 * Returns up to 2 non-overlapping windows, sorted by time.
 * Prefers the longest consistent window whose average is within 5 points of the best.
 */
export function findBestWindows(scoredForecasts: ScoredForecast[]): BestWindow[] {
  if (scoredForecasts.length === 0) return [];

  let topAvg = -1;
  const candidates: BestWindow[] = [];
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
    .filter(c => c.avg >= topAvg - 5 && c.avg >= 20)
    .sort((a, b) => b.len - a.len || b.avg - a.avg);

  const bestWindows: BestWindow[] = [];
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

  // Merge adjacent windows (window 1 ends where window 2 starts)
  for (let i = bestWindows.length - 1; i > 0; i--) {
    const prev = bestWindows[i - 1];
    const curr = bestWindows[i];
    if (prev.start + prev.len >= curr.start) {
      const newLen = curr.start + curr.len - prev.start;
      let sum = 0;
      for (let j = 0; j < newLen; j++) sum += scoredForecasts[prev.start + j].score;
      prev.len = newLen;
      prev.avg = sum / newLen;
      bestWindows.splice(i, 1);
    }
  }

  return bestWindows;
}
