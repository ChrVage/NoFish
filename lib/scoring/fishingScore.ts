/**
 * Depth-adaptive fishing score — Norwegian coast
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
 * An optional `depth` parameter (positive metres below sea level) tunes the
 * scoring to the seabed depth at the clicked location. When omitted the
 * classic 50–200 m deep-water profile is used.
 *
 * Variables (multiplied together as 0–1 factors, then scaled to 0–100):
 *   1. Current speed   – Gaussian peak adapted to depth (the base score)
 *   2. Wind & drift    – safety override + wind-current interaction
 *   3. Tide phase      – biological modifier, spread adapted to depth
 *   4. Moon phase      – tidal amplitude modifier, spread adapted to depth
 *   5. Light & temp    – dawn/dusk peak, bonus fades at extreme depth
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

// ── Depth profile ───────────────────────────────────────────────────────────

export interface DepthProfile {
  /** Gaussian peak for ideal current speed (m/s). */
  currentMu: number;
  /** Gaussian width for current speed. */
  currentSigma: number;
  /** How strongly tide phase matters (0 = no effect, 1 = full spread). */
  tideSpread: number;
  /** How strongly spring/neap distinction matters (0–1). */
  moonSpread: number;
  /** Strength of dawn/dusk fishing bonus (0–1). */
  dawnDuskBonus: number;
}

/** Return a depth profile that shifts scoring knobs based on seabed depth. */
export function getDepthProfile(depth: number | undefined): DepthProfile {
  if (depth === undefined) {
    // No depth data — use classic 50–200 m deep-water defaults
    return { currentMu: 0.40, currentSigma: 0.22, tideSpread: 0.75, moonSpread: 0.82, dawnDuskBonus: 0.70 };
  }
  const d = Math.abs(depth); // ensure positive
  if (d < 30)  {return { currentMu: 0.25, currentSigma: 0.18, tideSpread: 1.00, moonSpread: 1.00, dawnDuskBonus: 1.00 };}
  if (d < 100) {return { currentMu: 0.35, currentSigma: 0.20, tideSpread: 0.90, moonSpread: 0.90, dawnDuskBonus: 0.90 };}
  if (d < 200) {return { currentMu: 0.40, currentSigma: 0.22, tideSpread: 0.75, moonSpread: 0.82, dawnDuskBonus: 0.70 };}
  if (d < 400) {return { currentMu: 0.45, currentSigma: 0.25, tideSpread: 0.60, moonSpread: 0.70, dawnDuskBonus: 0.30 };}
  return              { currentMu: 0.50, currentSigma: 0.28, tideSpread: 0.50, moonSpread: 0.60, dawnDuskBonus: 0.10 };
}

// ── Moon phase age helper ───────────────────────────────────────────────────
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_DAYS = 29.53058770576;

function moonAge(date: Date): number {
  const days = (date.getTime() - NEW_MOON_EPOCH_MS) / 86_400_000;
  return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
}

// ── The scoring function ────────────────────────────────────────────────────

export function computeFishingScore(f: HourlyForecast, depth?: number): { score: number; safetyScore: number; fishingScore: number; reasons: Reason[] } {
  const dp = getDepthProfile(depth);
  const reasons: Reason[] = [];
  const good   = (text: string, category: 'safety' | 'fishing') => reasons.push({ text, tone: 'good', category });
  const bad    = (text: string, category: 'safety' | 'fishing') => reasons.push({ text, tone: 'bad', category });
  const danger = (text: string, category: 'safety' | 'fishing') => reasons.push({ text, tone: 'danger', category });

  // ═══ 1. CURRENT SPEED — base score (Gaussian, peak adapted to depth) ══
  //
  //   Peak shifts with depth: shallow → 0.25 m/s, deep → 0.50 m/s
  //   0.0 m/s → ~0.2  ("dead water")
  //   0.3–0.5 → ~1.0  (sweet spot)
  //   0.7     → ~0.7
  //   1.0     → ~0.2
  //   1.5+    → ~0.0
  //
  //   When no current data is available, use a cautious default (0.55)
  //   rather than a perfect 1.0 — "no current, no fish" philosophy means
  //   unknown current should not inflate the score.
  //
  let currentFactor = 0.55; // default when no current data (unknown → cautious)
  if (f.currentSpeed !== undefined) {
    const cs = f.currentSpeed;
    // Gaussian centred at depth-adjusted peak, σ from depth profile
    currentFactor = gaussian(cs, dp.currentMu, dp.currentSigma);
    // Floor for dead water (< 0.1 m/s → max 0.15)
    if (cs < 0.1) {currentFactor = Math.min(currentFactor, 0.15);}
    // Rapid drop above 1.0 m/s
    if (cs > 1.0) {currentFactor *= Math.max(0, 1 - (cs - 1.0) / 0.5);}

    const sweetLo = dp.currentMu - dp.currentSigma * 0.7;
    const sweetHi = dp.currentMu + dp.currentSigma * 0.7;
    if (cs >= sweetLo && cs <= sweetHi) {good(`Current ${cs.toFixed(2)} m/s — sweet spot`, 'fishing');}
    else if (cs < 0.15) {bad(`Current ${cs.toFixed(2)} m/s — dead water`, 'fishing');}
    else if (cs > 1.0) {danger(`⚠️ Current ${cs.toFixed(2)} m/s — unfishable`, 'fishing');}
    else if (cs > 0.7) {bad(`Current ${cs.toFixed(2)} m/s — gear drag`, 'fishing');}
    else if (cs < sweetLo) {bad(`Current ${cs.toFixed(2)} m/s — slow`, 'fishing');}
    else {good(`Current ${cs.toFixed(2)} m/s`, 'fishing');}
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
        if (angleDiff > 180) {angleDiff = 360 - angleDiff;}

        if (angleDiff > 120) {
          // Wind opposing current
          const cs = f.currentSpeed ?? 0;
          if (ws > 8 && cs > 0.5) {
            // Strong wind against strong current — dangerous steep breaking waves
            const severity = lerp01(ws, 8, 14) * lerp01(cs, 0.5, 1.0);
            windFactor *= Math.max(0.15, 1 - severity * 0.8);
            if (severity > 0.5) {danger(`⚠️ Wind against strong current — dangerous seas`, 'safety');}
            else {bad('Wind opposing strong current — steep chop', 'safety');}
          } else {
            // Light/moderate wind opposing current — slows drift, helps bottom contact
            const bonus = 0.1 * (ws / 8);
            windFactor = Math.min(1, windFactor + Math.min(bonus, 0.15));
            good('Wind opposing current', 'safety');
          }
        } else if (angleDiff < 60 && ws > 5) {
          // Wind aligned with current — bad drift
          const penalty = 0.1 * (ws / 8);
          windFactor = Math.max(0.15, windFactor - penalty);
          bad('Wind aligned with current', 'safety');
        }
      }

      if (ws <= 3) {good(`Light wind ${ws.toFixed(1)} m/s`, 'safety');}
      else if (ws <= 7) { /* neutral */ }
      else {bad(`Wind ${ws.toFixed(1)} m/s`, 'safety');}

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

  // ═══ 3. TIDE PHASE — biological modifier (spread adapted to depth) ═══
  //
  //   Mid-tide (Rising/Falling)  → 1.0  (peak nutrient exchange)
  //   Shallow water amplifies tidal effect; deep water compresses it.
  //   tideSpread=1.0 → full range (slack=0.40, rising=1.0)
  //   tideSpread=0.5 → compressed (slack=0.70, rising=1.0)
  //
  let tideFactor = 0.75; // default when no tide data
  if (f.tidePhase) {
    const tp = f.tidePhase.toLowerCase();
    // Base factors at full spread (tideSpread=1.0)
    let baseTide = 0.80;
    if (tp.includes('rising'))        {baseTide = 1.00;}
    else if (tp.includes('falling'))  {baseTide = 0.95;}
    else if (tp.match(/[+-]1h/))      {baseTide = 0.85;}
    else if (tp.match(/[+-]2h/))      {baseTide = 0.75;}
    else if (tp.match(/^(hi|lo)\b/i) || tp.includes('(')) {baseTide = 0.55;}

    // Compress toward 1.0 based on tideSpread: factor = 1 - spread * (1 - base)
    tideFactor = 1.0 - dp.tideSpread * (1.0 - baseTide);

    if (tp.includes('rising'))          {good('Rising tide — fish active', 'fishing');}
    else if (tp.includes('falling'))    {good('Falling tide', 'fishing');}
    else if (tp.match(/[+-]1h/))        {good('Tide turning', 'fishing');}
    else if (tp.match(/^(hi|lo)\b/i) || tp.includes('(')) {bad('Slack tide', 'fishing');}
  }

  // ═══ 4. MOON PHASE — tidal amplitude modifier (spread adapted) ═════
  //
  //   New/Full Moon (spring tides) → 1.0  (strongest pull)
  //   First/Last Quarter (neap)   → neap floor adapted by moonSpread
  //   Continuous cosine curve between them
  //
  let moonFactor = 0.90; // default
  const entryDate = new Date(f.time);
  if (f.moonPhase) {
    const age = moonAge(entryDate);
    const phase = (age / SYNODIC_DAYS) * 2 * Math.PI;
    // Raw cosine: 1.0 at new/full moon, 0.0 at quarters
    const cosVal = 0.5 + 0.5 * Math.cos(2 * phase);
    // Neap floor scales with moonSpread: spread=1→0.70, spread=0.5→0.85
    const neapFloor = 1.0 - dp.moonSpread * 0.30;
    moonFactor = neapFloor + (1.0 - neapFloor) * cosVal;

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
  //   At extreme depth the dawn/dusk feeding bonus fades (perpetual dark
  //   at the bottom), controlled by dp.dawnDuskBonus (0–1).
  //
  let lightFactor = 0.80; // default daylight (safety)
  let lightFishingFactor = 1.0; // default neutral (fishing)
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
      // Civil twilight = prime time — bonus scaled by depth
      lightFactor = 1.0;
      lightFishingFactor = 1.0 + 0.15 * dp.dawnDuskBonus; // up to 1.15 at shallow
      good('Good visibility', 'safety');
      good('Twilight — peak feeding', 'fishing');
    } else if (dominant.phase === 'day') {
      if (civilFrac > 0.1) {
        lightFactor = 1.0;
        lightFishingFactor = 1.0 + 0.12 * dp.dawnDuskBonus; // up to 1.12 at shallow
        good('Good visibility', 'safety');
        good('Dawn/dusk — active feeding', 'fishing');
      } else {
        lightFactor = 0.80;
        // Bright midday with clear sky → slight fishing penalty, scaled by depth
        if (f.cloudCover !== undefined && f.cloudCover < 20) {
          lightFactor = 0.70;
          lightFishingFactor = 1.0 - 0.10 * dp.dawnDuskBonus; // down to 0.90 at shallow (fish go deep)
          good('Clear sky', 'safety');
          bad('Bright sun — fish deep', 'fishing');
        } else if (f.cloudCover !== undefined && f.cloudCover >= 50) {
          lightFactor = 0.85;
          lightFishingFactor = 1.0 + 0.05 * dp.dawnDuskBonus; // slight bonus
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
      good(`Calm seas ${wh.toFixed(1)}m`, 'safety');
    } else if (wh <= 1.0) {
      waveFactor = 1.0 - 0.4 * sigmoid01(wh, 0.5, 1.0);
      if (wh <= 0.7) {good(`Low waves ${wh.toFixed(1)}m`, 'safety');}
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
  //   Only matters when waves are big enough to be a problem (> 1.5 m).
  //   Between 1.0–1.5 m the penalty is scaled down (small waves with short
  //   period are uncomfortable but not unsafe for a 21' boat).
  //
  let wavePeriodFactor = 1.0; // default when no data or calm seas
  if (f.wavePeriod !== undefined && f.waveHeight !== undefined && f.waveHeight > 1.0) {
    const wp = f.wavePeriod;
    // Scale penalty by wave height: 0 at 1.0 m, full at 1.5 m+
    const heightScale = Math.min(1, (f.waveHeight - 1.0) / 0.5);
    let rawPeriodFactor = 1.0;
    let reason: { text: string; tone: 'good' | 'bad' | 'danger' } | null = null;

    if (wp >= 10) {
      rawPeriodFactor = 1.0;
      reason = { text: 'Long swell — comfortable', tone: 'good' };
    } else if (wp >= 7) {
      rawPeriodFactor = 0.85 + 0.15 * lerp01(wp, 7, 10);
    } else if (wp >= 5) {
      rawPeriodFactor = 0.60 + 0.25 * lerp01(wp, 5, 7);
      reason = { text: `Short waves ${wp.toFixed(1)}s`, tone: 'bad' };
    } else {
      rawPeriodFactor = 0.30 + 0.30 * lerp01(wp, 3, 5);
      reason = { text: `⚠️ Steep chop ${wp.toFixed(1)}s`, tone: 'danger' };
    }

    // Blend toward 1.0 for smaller waves
    wavePeriodFactor = 1.0 - heightScale * (1.0 - rawPeriodFactor);
    if (reason && heightScale >= 0.5) {
      reasons.push({ ...reason, category: 'safety' as const });
    }
  }

  // ═══ 11. UV INDEX — informational safety warning (no score effect) ════
  //
  //   UV ≥ 1 → show info in safety reasons
  //   UV ≥ 3 → remind to wear sunscreen
  //   UV ≥ 6 → strong UV warning
  //   UV ≥ 8 → very high UV warning
  //   Does not affect the safety score — purely informational.
  //
  if (f.uvIndex !== undefined && f.uvIndex > 1) {
    const uv = Math.round(f.uvIndex);
    if (uv < 2) {
      // rounds to 1 or less — skip display
    } else if (uv >= 8) {
      reasons.push({ text: `☀️ UV ${uv} — very high! Wear sunscreen`, tone: 'danger', category: 'safety' });
    } else if (uv >= 6) {
      reasons.push({ text: `☀️ UV ${uv} — high, wear sunscreen`, tone: 'bad', category: 'safety' });
    } else if (uv >= 3) {
      reasons.push({ text: `☀️ UV ${uv} — wear sunscreen`, tone: 'bad', category: 'safety' });
    } else {
      reasons.push({ text: `UV ${uv}`, tone: 'good', category: 'safety' });
    }
  }

  // ═══ COMBINE — multiply factors, scale to 0–100 ══════════════════════
  const safetyRaw = windFactor * waveFactor * lightFactor * wavePeriodFactor;
  const fishingRaw = currentFactor * tideFactor * moonFactor * precipFactor * tempFactor * pressureFactor * lightFishingFactor;
  const raw = safetyRaw * fishingRaw;
  const score = Math.round(Math.max(0, Math.min(100, raw * 100)));
  const safetyScore = Math.round(Math.max(0, Math.min(100, safetyRaw * 100)));
  const fishingScore = Math.round(Math.max(0, Math.min(100, fishingRaw * 100)));

  return { score, safetyScore, fishingScore, reasons };
}

// ── Score display helpers ───────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 70) {return '#166534';} // green-800
  if (score >= 50) {return '#15803d';} // green-700
  if (score >= 35) {return '#92400e';} // amber-800
  if (score >= 20) {return '#c2410c';} // orange-700
  return '#991b1b';                  // red-800
}

export function getScoreBg(score: number): string {
  if (score >= 70) {return '#f0fdf4';} // green-50
  if (score >= 50) {return '#fefce8';} // yellow-50
  if (score >= 35) {return '#fffbeb';} // amber-50
  if (score >= 20) {return '#fff7ed';} // orange-50
  return '#fef2f2';                  // red-50
}

// ── Best fishing window finder ──────────────────────────────────────────────

/**
 * Find best fishing windows (1–3 hours) from a list of scored forecasts.
 * Returns up to 3 non-overlapping windows, sorted by time.
 * Prefers the longest consistent window whose average is within 5 points of the best.
 *
 * If the best window starts at the very beginning of the forecast (index 0),
 * the search widens to topAvg−15 to ensure at least one future alternative is
 * included when possible, so the user can plan ahead.
 *
 * Windows are only shown when the hours are free of danger-level conditions.
 * If every hour in the forecast has a danger reason, "No safe fishing periods" is shown.
 */
export function findBestWindows(scoredForecasts: ScoredForecast[]): BestWindow[] {
  if (scoredForecasts.length === 0) {return [];}

  // A window is eligible only if none of its hours have a danger-tone reason
  const hasDanger = (idx: number) =>
    scoredForecasts[idx].reasons.some(r => r.tone === 'danger');

  let topAvg = -1;
  const candidates: BestWindow[] = [];
  for (let len = 1; len <= 3; len++) {
    for (let i = 0; i <= scoredForecasts.length - len; i++) {
      // Skip windows containing any hour with danger conditions
      let dangerInWindow = false;
      for (let j = 0; j < len; j++) {
        if (hasDanger(i + j)) { dangerInWindow = true; break; }
      }
      if (dangerInWindow) {continue;}

      let sum = 0;
      for (let j = 0; j < len; j++) {sum += scoredForecasts[i + j].score;}
      const avg = sum / len;
      candidates.push({ start: i, len, avg });
      if (avg > topAvg) {topAvg = avg;}
    }
  }

  // No safe windows at all — every hour has a danger condition
  if (candidates.length === 0) {return [];}

  // Among windows within 5 points of the best, pick the longest (then highest avg)
  const viable = candidates
    .filter(c => c.avg >= topAvg - 5)
    .sort((a, b) => b.len - a.len || b.avg - a.avg);

  const bestWindows: BestWindow[] = [];
  for (const c of viable) {
    const overlaps = bestWindows.some(w =>
      c.start < w.start + w.len && c.start + c.len > w.start
    );
    if (!overlaps) {
      bestWindows.push(c);
      if (bestWindows.length === 3) {break;}
    }
  }

  // If the best window starts at index 0 and we have fewer than 2, widen the
  // threshold to topAvg−15 to find at least one future alternative for planning.
  if (bestWindows.length < 2 && bestWindows.some(w => w.start === 0)) {
    const wider = candidates
      .filter(c => c.avg >= topAvg - 15)
      .sort((a, b) => b.len - a.len || b.avg - a.avg);
    for (const c of wider) {
      if (bestWindows.length >= 3) {break;}
      const overlaps = bestWindows.some(w =>
        c.start < w.start + w.len && c.start + c.len > w.start
      );
      if (!overlaps) {
        bestWindows.push(c);
      }
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
      for (let j = 0; j < newLen; j++) {sum += scoredForecasts[prev.start + j].score;}
      prev.len = newLen;
      prev.avg = sum / newLen;
      bestWindows.splice(i, 1);
    }
  }

  return bestWindows;
}
