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
import type { BoatSizePreset, FishTarget, FishingMethod } from '@/lib/utils/tuning';

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Hard ceiling for the safety score (0–100).
 *
 * The open Norwegian coast is never 100 % safe — even in perfect forecasted
 * conditions you still depend on factors no API can know about: boat
 * seaworthiness, life-jackets, VHF/EPIRB, fuel reserves, crew experience,
 * local knowledge, communicated weather window, etc. We therefore cap the
 * safety score below 100 to make clear that the remaining percentage must be
 * earned through measures outside the forecast.
 */
export const MAX_SAFETY_SCORE = 90;

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

export interface MethodRecommendation {
  method: FishingMethod;
  score: number;
  reason: string;
  recommended: boolean;
}

export interface ComputeScoreOptions {
  depth?: number;
  boat?: BoatSizePreset;
  fish?: FishTarget;
  method?: FishingMethod;
  timezone?: string;
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

interface BoatSafetyProfile {
  stormWind: number;
  stormGust: number;
  strongWindStart: number;
  strongWindEnd: number;
  strongGustStart: number;
  waveCalm: number;
  waveModerate: number;
  waveDanger: number;
  shortWavePeriodStart: number;
}

interface SpeciesSeasonProfile {
  prime: number[];
  shoulder?: number[];
}

interface SpeciesWaterColumnProfile {
  habitatMinDepth: number;
  habitatMaxDepth: number;
  targetZoneLabel: string;
}

interface SpeciesBehaviorProfile {
  displayName: string;
  preferredDepths: number[];
  season: SpeciesSeasonProfile;
  column: SpeciesWaterColumnProfile;
}

function getBoatSafetyProfile(boat: BoatSizePreset | undefined): BoatSafetyProfile {
  switch (boat) {
  case '15-19':
    return {
      stormWind: 13.5,
      stormGust: 20,
      strongWindStart: 10,
      strongWindEnd: 13.5,
      strongGustStart: 16,
      waveCalm: 0.4,
      waveModerate: 0.8,
      waveDanger: 1.6,
      shortWavePeriodStart: 5.5,
    };
  case '25-30':
    return {
      stormWind: 16.5,
      stormGust: 24,
      strongWindStart: 13,
      strongWindEnd: 16.5,
      strongGustStart: 19,
      waveCalm: 0.55,
      waveModerate: 1.1,
      waveDanger: 2.2,
      shortWavePeriodStart: 4.8,
    };
  case '31-40':
    return {
      stormWind: 18,
      stormGust: 26,
      strongWindStart: 14,
      strongWindEnd: 18,
      strongGustStart: 21,
      waveCalm: 0.6,
      waveModerate: 1.25,
      waveDanger: 2.5,
      shortWavePeriodStart: 4.5,
    };
  case '20-24':
  default:
    return {
      stormWind: 15,
      stormGust: 22,
      strongWindStart: 12,
      strongWindEnd: 15,
      strongGustStart: 18,
      waveCalm: 0.5,
      waveModerate: 1.0,
      waveDanger: 2.0,
      shortWavePeriodStart: 5.0,
    };
  }
}

const SPECIES_BEHAVIOR: Partial<Record<FishTarget, SpeciesBehaviorProfile>> = {
  cod: {
    displayName: 'Cod',
    preferredDepths: [90],
    season: { prime: [1, 2, 3, 4, 10, 11, 12], shoulder: [5, 9] },
    column: { habitatMinDepth: 20, habitatMaxDepth: 220, targetZoneLabel: 'near bottom (5-20 m above seabed)' },
  },
  saithe: {
    displayName: 'Saithe',
    preferredDepths: [60],
    season: { prime: [5, 6, 7, 8, 9], shoulder: [4, 10] },
    column: { habitatMinDepth: 20, habitatMaxDepth: 180, targetZoneLabel: 'mid-water schools (20-90 m)' },
  },
  haddock: {
    displayName: 'Haddock',
    preferredDepths: [120],
    season: { prime: [2, 3, 4, 5, 9, 10, 11], shoulder: [1, 6, 8, 12] },
    column: { habitatMinDepth: 40, habitatMaxDepth: 260, targetZoneLabel: 'close to bottom (0-15 m above seabed)' },
  },
  mackerel: {
    displayName: 'Mackerel',
    preferredDepths: [25],
    season: { prime: [6, 7, 8, 9], shoulder: [5, 10] },
    column: { habitatMinDepth: 10, habitatMaxDepth: 9999, targetZoneLabel: 'upper water column (surface-40 m)' },
  },
  pollock: {
    displayName: 'Pollock',
    preferredDepths: [30, 130],
    season: { prime: [4, 5, 6, 7, 8, 9, 10], shoulder: [3, 11] },
    column: { habitatMinDepth: 20, habitatMaxDepth: 220, targetZoneLabel: 'mid-water near structure (10-80 m above bottom)' },
  },
  halibut: {
    displayName: 'Halibut',
    preferredDepths: [150],
    season: { prime: [5, 6, 7, 8, 9, 10], shoulder: [4, 11] },
    column: { habitatMinDepth: 50, habitatMaxDepth: 350, targetZoneLabel: 'bottom zone on banks and edges' },
  },
  ling: {
    displayName: 'Ling',
    preferredDepths: [220],
    season: { prime: [3, 4, 5, 6, 7, 8, 9, 10, 11], shoulder: [2, 12] },
    column: { habitatMinDepth: 120, habitatMaxDepth: 450, targetZoneLabel: 'deep bottom (0-10 m above seabed)' },
  },
  tusk: {
    displayName: 'Tusk',
    preferredDepths: [260],
    season: { prime: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    column: { habitatMinDepth: 150, habitatMaxDepth: 500, targetZoneLabel: 'deep bottom and rough ground' },
  },
  monkfish: {
    displayName: 'Monkfish',
    preferredDepths: [130],
    season: { prime: [5, 6, 7, 8, 9, 10, 11], shoulder: [4, 12] },
    column: { habitatMinDepth: 60, habitatMaxDepth: 260, targetZoneLabel: 'bottom ambush zone' },
  },
  wolffish: {
    displayName: 'Wolffish',
    preferredDepths: [100],
    season: { prime: [1, 2, 3, 4, 10, 11, 12], shoulder: [5, 9] },
    column: { habitatMinDepth: 40, habitatMaxDepth: 220, targetZoneLabel: 'close to rocky bottom' },
  },
  redfish: {
    displayName: 'Redfish',
    preferredDepths: [300],
    season: { prime: [6, 7, 8, 9, 10, 11], shoulder: [5, 12] },
    column: { habitatMinDepth: 180, habitatMaxDepth: 600, targetZoneLabel: 'deep mid-water over deep bottom' },
  },
  plaice: {
    displayName: 'Plaice',
    preferredDepths: [70],
    season: { prime: [4, 5, 6, 7, 8, 9, 10], shoulder: [3, 11] },
    column: { habitatMinDepth: 15, habitatMaxDepth: 160, targetZoneLabel: 'on sandy bottom' },
  },
  hake: {
    displayName: 'Hake',
    preferredDepths: [180],
    season: { prime: [7, 8, 9, 10, 11], shoulder: [6, 12] },
    column: { habitatMinDepth: 100, habitatMaxDepth: 380, targetZoneLabel: 'mid to deep water above bottom' },
  },
};

function getSpeciesBehavior(fish: FishTarget | undefined): SpeciesBehaviorProfile | undefined {
  if (!fish || fish === 'general') {return undefined;}
  return SPECIES_BEHAVIOR[fish];
}

function speciesDepths(fish: FishTarget | undefined): number[] {
  return getSpeciesBehavior(fish)?.preferredDepths ?? [];
}

function seasonFactorForMonth(season: SpeciesSeasonProfile, month: number): number {
  if (season.prime.includes(month)) {return 1.0;}
  if ((season.shoulder ?? []).includes(month)) {return 0.45;}
  return 0.05;
}

function monthInTimezone(date: Date, timezone: string | undefined): number {
  if (!timezone) {return date.getUTCMonth() + 1;}
  const parts = new Intl.DateTimeFormat('en-GB', {
    month: '2-digit',
    timeZone: timezone,
  }).formatToParts(date);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '1', 10);
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : (date.getUTCMonth() + 1);
}

function waterColumnFactor(profile: SpeciesWaterColumnProfile, depth: number | undefined): number {
  if (depth === undefined) {return 1.0;}
  const d = Math.abs(depth);
  if (d >= profile.habitatMinDepth && d <= profile.habitatMaxDepth) {return 1.0;}

  const belowMin = d < profile.habitatMinDepth;
  const edge = belowMin ? profile.habitatMinDepth : profile.habitatMaxDepth;
  const dist = Math.abs(d - edge);
  const scale = Math.max(40, edge * 0.6);
  const penalty = Math.min(0.35, dist / scale * 0.35);
  return Math.max(0.65, 1 - penalty);
}

function blendedDepth(baseDepth: number | undefined, preferredDepth: number): number {
  if (baseDepth === undefined) {return preferredDepth;}
  return baseDepth * 0.6 + preferredDepth * 0.4;
}

function getSpeciesProfiles(depth: number | undefined, fish: FishTarget | undefined): DepthProfile[] {
  const preferred = speciesDepths(fish);
  if (preferred.length === 0) {
    return [getDepthProfile(depth)];
  }
  return preferred.map((d) => getDepthProfile(blendedDepth(depth, d)));
}

function combineDepthProfiles(profiles: DepthProfile[]): DepthProfile {
  if (profiles.length === 1) {return profiles[0];}
  const sum = profiles.reduce((acc, p) => ({
    currentMu: acc.currentMu + p.currentMu,
    currentSigma: acc.currentSigma + p.currentSigma,
    tideSpread: acc.tideSpread + p.tideSpread,
    moonSpread: acc.moonSpread + p.moonSpread,
    dawnDuskBonus: acc.dawnDuskBonus + p.dawnDuskBonus,
  }), { currentMu: 0, currentSigma: 0, tideSpread: 0, moonSpread: 0, dawnDuskBonus: 0 });
  const n = profiles.length;
  return {
    currentMu: sum.currentMu / n,
    currentSigma: sum.currentSigma / n,
    tideSpread: sum.tideSpread / n,
    moonSpread: sum.moonSpread / n,
    dawnDuskBonus: sum.dawnDuskBonus / n,
  };
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

/**
 * Net fishing method factor — adapts to seasonal daylight changes.
 *
 * Setting:    Near dusk (evening twilight) — any hour when dominant phase is
 *             'civil' or 'nautical' in the evening (roughly 16:00–23:00).
 *             Peaks during civil twilight. Full score if actively setting in
 *             good light to see the net.
 *
 * Collecting: Near dawn (morning twilight) — any hour when dominant phase is
 *             'civil' or 'nautical' in the morning (roughly 04:00–08:00).
 *             Peaks during civil twilight just before/after sunrise.
 *
 * Winter: Sunset ~16:00 (civil twilight 15:00–16:30) → setting scores well at 16:00
 * Summer: Sunset ~22:00 (civil twilight 21:00–22:30) → setting scores well at 22:00
 *
 * Other hours: 0 (full daylight or deep night without twilight transitions)
 */
function netFishingMethodFactor(hour: number, sunPhaseSegments: Array<{ phase: string; fraction: number }> | undefined): number {
  if (!sunPhaseSegments || sunPhaseSegments.length === 0) {
    return 0.0; // No sun data, can't score reliably
  }

  const dominant = sunPhaseSegments.reduce((a, b) => b.fraction > a.fraction ? b : a);
  const civilFrac = sunPhaseSegments.find(s => s.phase === 'civil')?.fraction ?? 0;
  const nauticalFrac = sunPhaseSegments.find(s => s.phase === 'nautical')?.fraction ?? 0;

  // ─── EVENING SETTING: ~16:00–23:00 (covers winter/summer seasonal shifts) ────
  if (hour >= 15 && hour < 23) {
    // Best: civil twilight (good light to set net properly)
    if (dominant.phase === 'civil' && civilFrac > 0.5) {
      return 1.0; // Perfect setting time
    }
    // Good: mix of civil and nautical (transitioning to night)
    if ((dominant.phase === 'civil' || dominant.phase === 'nautical') && (civilFrac + nauticalFrac) > 0.6) {
      return 0.85;
    }
    // Acceptable: nautical twilight (can still set, but dimmer)
    if (dominant.phase === 'nautical' && nauticalFrac > 0.5) {
      return 0.7;
    }
    // Marginal: approaching night but some twilight present
    if (nauticalFrac > 0.2) {
      return 0.5;
    }
  }

  // ─── EARLY MORNING COLLECTING: ~04:00–08:00 (covers seasonal dawn shifts) ────
  if (hour >= 3 && hour <= 8) {
    // Best: civil twilight (sunrise/dawn light, ideal for collecting)
    if (dominant.phase === 'civil' && civilFrac > 0.5) {
      return 1.0; // Perfect collecting time
    }
    // Good: mix of nautical and civil (approaching dawn)
    if ((dominant.phase === 'civil' || dominant.phase === 'nautical') && (civilFrac + nauticalFrac) > 0.6) {
      return 0.85;
    }
    // Acceptable: nautical twilight (starting to brighten)
    if (dominant.phase === 'nautical' && nauticalFrac > 0.5) {
      return 0.7;
    }
    // Marginal: very early, still mostly night but twilight approaching
    if (nauticalFrac > 0.2) {
      return 0.5;
    }
  }

  // All other hours or conditions: not ideal for net fishing
  return 0.0;
}

// ── The scoring function ────────────────────────────────────────────────────

export function computeFishingScore(f: HourlyForecast, depthOrOptions?: number | ComputeScoreOptions): { score: number; safetyScore: number; fishingScore: number; reasons: Reason[] } {
  const options: ComputeScoreOptions = typeof depthOrOptions === 'number'
    ? { depth: depthOrOptions }
    : (depthOrOptions ?? {});
  const profiles = getSpeciesProfiles(options.depth, options.fish);
  const speciesBehavior = getSpeciesBehavior(options.fish);
  const dp = combineDepthProfiles(profiles);
  const boatSafety = getBoatSafetyProfile(options.boat);
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
    // For multi-depth species (for example pollock), allow either depth band to score well.
    currentFactor = profiles.reduce((best, p) => Math.max(best, gaussian(cs, p.currentMu, p.currentSigma)), 0);
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
    if (ws > boatSafety.stormWind || gs > boatSafety.stormGust) {
      windFactor = 0;
      danger(`⚠️ Storm — ${ws.toFixed(1)} m/s (gusts ${gs.toFixed(1)})`, 'safety');
    } else if (ws > boatSafety.strongWindStart || gs > boatSafety.strongGustStart) {
      windFactor = (1 - lerp01(Math.max(ws, gs * 0.7), boatSafety.strongWindStart, boatSafety.strongWindEnd)) * 0.20;
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
          const brightSunPenalty = 0.10 * dp.dawnDuskBonus; // penalty fades with depth
          lightFishingFactor = 1.0 - brightSunPenalty;
          good('Clear sky', 'safety');
          if (brightSunPenalty >= 0.05) {
            bad('Bright sun — fish deep', 'fishing');
          } else {
            good('Bright sun less relevant at depth', 'fishing');
          }
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

    // Long-period swell is far more manageable than short-period chop of the
    // same height. Use wave steepness (deep-water approximation) to derive an
    // effective height for the bracket/factor computation while keeping the
    // actual height in all feedback messages.
    //   Steepness ≈ H × 0.640 / T²   (from dispersion relation g·T²/2π)
    //   T = 9.2 s, H = 1.2 m  →  S ≈ 0.009  (gentle rolling swell, no problem)
    //   T = 5.0 s, H = 1.2 m  →  S ≈ 0.031  (short chop, uncomfortable)
    let effectiveWh = wh;
    if (f.wavePeriod !== undefined && f.wavePeriod > 0) {
      const T = f.wavePeriod;
      const steepness = (wh * 0.640) / (T * T);
      if (steepness < 0.012) {
        effectiveWh = wh * 0.55;                            // very gentle rolling swell
      } else if (steepness < 0.025) {
        const t = (steepness - 0.012) / 0.013;
        effectiveWh = wh * (0.55 + 0.45 * t);              // blends back to full at S=0.025
      }
      // steepness ≥ 0.025: short chop — penalise full actual height
    }

    if (effectiveWh <= boatSafety.waveCalm) {
      waveFactor = 1.0;
      good(`Calm seas ${wh.toFixed(1)}m`, 'safety');
    } else if (effectiveWh <= boatSafety.waveModerate) {
      waveFactor = 1.0 - 0.4 * sigmoid01(effectiveWh, boatSafety.waveCalm, boatSafety.waveModerate);
      if (wh > 0.8 && effectiveWh < wh * 0.85) {
        good(`Long-period swell softens wave risk (${wh.toFixed(1)}m)`, 'safety');
      } else if (wh <= 0.7) {
        good(`Low waves ${wh.toFixed(1)}m`, 'safety');
      }
    } else if (effectiveWh <= boatSafety.waveDanger) {
      waveFactor = 0.6 - 0.5 * sigmoid01(effectiveWh, boatSafety.waveModerate, boatSafety.waveDanger);
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
      waveFactor = Math.max(0, 0.1 - 0.1 * sigmoid01(effectiveWh, boatSafety.waveDanger, boatSafety.waveDanger + 1.0));
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

  // ═══ 8b. SPECIES WATER COLUMN / HABITAT DEPTH ═════════════════════════
  //
  //   Penalise when selected species is unlikely at the seabed depth of the
  //   chosen location. This approximates where in the water column each
  //   species is typically targeted.
  //
  let speciesColumnFactor = 1.0;
  if (speciesBehavior) {
    speciesColumnFactor = waterColumnFactor(speciesBehavior.column, options.depth);

    if (options.depth !== undefined) {
      const d = Math.round(Math.abs(options.depth));
      if (speciesColumnFactor >= 0.98) {
        good(`${speciesBehavior.displayName}: ${speciesBehavior.column.targetZoneLabel}`, 'fishing');
      } else if (speciesColumnFactor <= 0.75) {
        bad(`${speciesBehavior.displayName}: depth ${d} m is outside typical habitat`, 'fishing');
      } else {
        bad(`${speciesBehavior.displayName}: depth ${d} m is suboptimal`, 'fishing');
      }
    }
  }

  // ═══ 8c. SPECIES SEASONALITY ═══════════════════════════════════════════
  //
  //   Species activity differs by season. Prime months are neutral (1.0),
  //   shoulder months get a small reduction, off-season gets stronger
  //   reduction.
  //
  let speciesSeasonFactor = 1.0;
  if (speciesBehavior) {
    const month = monthInTimezone(entryDate, options.timezone);
    speciesSeasonFactor = seasonFactorForMonth(speciesBehavior.season, month);

    const isYearRound = speciesBehavior.season.prime.length === 12;
    if (speciesSeasonFactor >= 0.99 && !isYearRound) {
      good(`${speciesBehavior.displayName}: in-season`, 'fishing');
    } else if (speciesSeasonFactor >= 0.40) {
      bad(`${speciesBehavior.displayName}: shoulder season`, 'fishing');
    } else {
      bad(`${speciesBehavior.displayName}: off-season — not present`, 'fishing');
    }
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
    const wh = f.waveHeight;
    // Scale penalty by wave height: 0 at 1.0 m, full at 1.5 m+
    const heightScale = Math.min(1, (wh - 1.0) / 0.5);
    let rawPeriodFactor = 1.0;
    let reason: { text: string; tone: 'good' | 'bad' | 'danger' } | null = null;

    if (wp >= 10) {
      rawPeriodFactor = 1.0;
      reason = { text: 'Long swell — comfortable', tone: 'good' };
    } else if (wp >= 7) {
      rawPeriodFactor = 0.85 + 0.15 * lerp01(wp, 7, 10);
    } else if (wp >= boatSafety.shortWavePeriodStart) {
      rawPeriodFactor = 0.60 + 0.25 * lerp01(wp, boatSafety.shortWavePeriodStart, 7);
      reason = { text: `Short waves ${wp.toFixed(1)}s`, tone: 'bad' };
    } else {
      rawPeriodFactor = 0.30 + 0.30 * lerp01(wp, 3, boatSafety.shortWavePeriodStart);
      reason = { text: `⚠️ Steep chop ${wp.toFixed(1)}s`, tone: 'danger' };
    }

    // Blend toward 1.0 for smaller waves
    wavePeriodFactor = 1.0 - heightScale * (1.0 - rawPeriodFactor);
    // Note: long-period swell relief is now handled in section 6 via steepness-based
    // effectiveWh, so no separate waveFactor adjustment is needed here.

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

  // ═══ 12. DRIFT ICE — safety warning (no score effect) ═════════════════
  //
  //   Very cold sea can produce drifting slush/ice, especially when
  //   wind/current can transport it into routes and nearshore areas.
  //   This is a safety warning only and does not alter score factors.
  //
  if (f.seaTemperature !== undefined) {
    const st = f.seaTemperature;
    const ws = f.windSpeed ?? 0;
    const gs = f.windGust ?? ws;
    const windStress = Math.max(ws, gs * 0.7);
    const driftStress = Math.max(windStress / 10, f.currentSpeed ?? 0);

    if (st <= 0) {
      if (driftStress >= 0.7) {
        reasons.push({ text: `🧊 Sea ${st.toFixed(1)}°C — drift ice likely`, tone: 'danger', category: 'safety' });
      } else {
        reasons.push({ text: `🧊 Sea ${st.toFixed(1)}°C — drift ice possible`, tone: 'danger', category: 'safety' });
      }
    } else if (st <= 1 && driftStress >= 0.7) {
      reasons.push({ text: `🧊 Near-freezing sea ${st.toFixed(1)}°C — watch for drift ice`, tone: 'bad', category: 'safety' });
    }
  }

  // ═══ 13. FISHING METHOD — e.g. net fishing restricted to set/collect times ═
  let methodFactor = 1.0;
  if (options.method === 'net') {
    const timezone = options.timezone ?? 'UTC';
    const h = localHour(f.time, timezone);
    methodFactor = netFishingMethodFactor(h, f.sunPhaseSegments);
    if (methodFactor === 0) {
      bad('Net fishing: only available at set/collect times (evening/early morning)', 'fishing');
    }
  }

  // ═══ COMBINE — multiply factors, scale to 0–100 ══════════════════════
  // The exposed ocean can never be 100 % safe. Forecast data alone cannot
  // capture boat condition, life-jackets, communication equipment, crew
  // experience, local knowledge, or chosen weather window. We therefore cap
  // the safety score at MAX_SAFETY_SCORE — the remaining headroom must be
  // earned through measures outside the API data.
  const safetyRaw = windFactor * waveFactor * lightFactor * wavePeriodFactor;
  const safetyRawCapped = Math.min(safetyRaw, MAX_SAFETY_SCORE / 100);
  const fishingRaw = currentFactor * tideFactor * moonFactor * precipFactor * tempFactor * speciesColumnFactor * speciesSeasonFactor * pressureFactor * lightFishingFactor * methodFactor;
  const raw = safetyRawCapped * fishingRaw;
  const score = Math.round(Math.max(0, Math.min(100, raw * 100)));
  const safetyScore = Math.round(Math.max(0, Math.min(MAX_SAFETY_SCORE, safetyRawCapped * 100)));
  const fishingScore = Math.round(Math.max(0, Math.min(100, fishingRaw * 100)));

  return { score, safetyScore, fishingScore, reasons };
}

function clampScore(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)));
}

function localHour(iso: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: timezone }).formatToParts(new Date(iso));
  return parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
}

function localDateKey(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '00';
  const d = parts.find((p) => p.type === 'day')?.value ?? '00';
  return `${y}-${m}-${d}`;
}

const SPECIES_METHOD_PREFS: Record<FishTarget, FishingMethod[]> = {
  general: ['same-spot', 'trolling', 'pot', 'net'],
  cod: ['same-spot', 'pot', 'net', 'trolling'],
  saithe: ['trolling', 'same-spot', 'net', 'pot'],
  haddock: ['same-spot', 'net', 'pot', 'trolling'],
  mackerel: ['trolling', 'same-spot', 'net', 'pot'],
  pollock: ['trolling', 'same-spot', 'pot', 'net'],
  halibut: ['same-spot', 'trolling', 'pot', 'net'],
  ling: ['same-spot', 'pot', 'net', 'trolling'],
  tusk: ['same-spot', 'pot', 'net', 'trolling'],
  monkfish: ['same-spot', 'net', 'pot', 'trolling'],
  wolffish: ['same-spot', 'pot', 'net', 'trolling'],
  redfish: ['same-spot', 'pot', 'net', 'trolling'],
  plaice: ['same-spot', 'net', 'pot', 'trolling'],
  hake: ['same-spot', 'trolling', 'pot', 'net'],
};

export function recommendFishingMethods(
  scoredForecasts: ScoredForecast[],
  timezone: string,
  fish: FishTarget,
): MethodRecommendation[] {
  if (scoredForecasts.length === 0) {return [];}

  const next48h = scoredForecasts.slice(0, 48);
  const avgScore = next48h.reduce((s, x) => s + x.score, 0) / next48h.length;

  const tomorrowKey = (() => {
    const first = scoredForecasts[0]?.forecast.time;
    if (!first) {return null;}
    const d = new Date(first);
    d.setUTCDate(d.getUTCDate() + 1);
    return localDateKey(d.toISOString(), timezone);
  })();

  const morningAfter = tomorrowKey
    ? scoredForecasts.filter((x) => {
      const sameDay = localDateKey(x.forecast.time, timezone) === tomorrowKey;
      const h = localHour(x.forecast.time, timezone);
      return sameDay && h >= 5 && h <= 10;
    })
    : [];
  const morningAfterCalm = morningAfter.length > 0
    && morningAfter.every((x) => (x.forecast.windSpeed ?? 0) <= 8 && (x.forecast.waveHeight ?? 0) <= 1.1 && x.safetyScore >= 60);

  const nights = scoredForecasts.filter((x) => {
    const h = localHour(x.forecast.time, timezone);
    return h >= 22 || h <= 5;
  });
  const potCurrentOk = nights.length > 0 && nights.every((x) => {
    const cs = x.forecast.currentSpeed;
    if (cs === undefined) {return true;}
    return cs >= 0.12 && cs <= 0.75;
  });

  const allMethods: MethodRecommendation[] = [
    {
      method: 'trolling',
      score: clampScore(avgScore + next48h.reduce((sum, x) => {
        const cs = x.forecast.currentSpeed ?? 0.35;
        const ws = x.forecast.windSpeed ?? 5;
        const wh = x.forecast.waveHeight ?? 0.8;
        const fit = (cs >= 0.15 && cs <= 0.9 ? 8 : -8) + (ws <= 10 ? 6 : -10) + (wh <= 1.5 ? 6 : -12);
        return sum + fit;
      }, 0) / next48h.length),
      reason: 'Best when drift is manageable and fish are moving in mid-water.',
      recommended: false,
    },
    {
      method: 'same-spot',
      score: clampScore(avgScore + next48h.reduce((sum, x) => {
        const cs = x.forecast.currentSpeed ?? 0.35;
        const ws = x.forecast.windSpeed ?? 5;
        const fit = (cs >= 0.2 && cs <= 0.7 ? 10 : -8) + (ws <= 9 ? 6 : -10);
        return sum + fit;
      }, 0) / next48h.length),
      reason: 'Strong for controlled bottom contact when current is steady.',
      recommended: false,
    },
    {
      method: 'net',
      score: clampScore((morningAfterCalm ? 1.0 : 0.55) * (avgScore + next48h.reduce((sum, x) => {
        const ws = x.forecast.windSpeed ?? 5;
        const wh = x.forecast.waveHeight ?? 0.8;
        const calmFit = (ws <= 8 ? 8 : -12) + (wh <= 1.2 ? 8 : -14);
        return sum + calmFit;
      }, 0) / next48h.length)),
      reason: morningAfterCalm
        ? 'Good — overnight soak requires calm deployment and calm retrieval at dawn.'
        : 'Penalized — overnight retrieval at dawn may see worse conditions than deployment.',
      recommended: false,
    },
    {
      method: 'pot',
      score: clampScore((potCurrentOk ? 1.0 : 0.7) * (avgScore + next48h.reduce((sum, x) => {
        const cs = x.forecast.currentSpeed;
        const okCurrent = cs === undefined || (cs >= 0.12 && cs <= 0.75);
        const ws = x.forecast.windSpeed ?? 5;
        const fit = (okCurrent ? 8 : -14) + (ws <= 11 ? 4 : -8);
        return sum + fit;
      }, 0) / next48h.length)),
      reason: potCurrentOk
        ? 'Night current and coming days support stable bottom pots.'
        : 'Reduced because night current is too weak/strong for bottom pots.',
      recommended: false,
    },
  ];

  const rankedBySpecies = SPECIES_METHOD_PREFS[fish];
  const boosted = allMethods.map((m) => {
    const rank = rankedBySpecies.indexOf(m.method);
    const speciesBonus = rank >= 0 ? Math.max(0, 12 - rank * 4) : 0;
    return { ...m, score: clampScore(m.score + speciesBonus) };
  });

  const topMethods = boosted
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((m) => m.method);

  return boosted
    .map((m) => ({ ...m, recommended: topMethods.includes(m.method) }))
    .sort((a, b) => b.score - a.score);
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
 * Check if an hour is within overnight fishing period (22:00–05:00 local time).
 * Nets are typically deployed before or at dusk, soaked overnight, retrieved at dawn.
 */
function isOvernightHour(time: string, timezone: string): boolean {
  const h = localHour(time, timezone);
  // 22:00–23:59 or 00:00–05:00
  return h >= 22 || h <= 5;
}

/**
 * Find best fishing windows for net deployment.
 * For net fishing: requires safe conditions for both deployment AND retrieval,
 * preferably overnight (22:00–05:00). Searches for 6–8 hour windows where:
 *   1. Set hour (start) has safetyScore ≥ 65, no danger
 *   2. Pickup hour (start + 6/7/8) has safetyScore ≥ 65, no danger
 *   3. Prefers overnight timing (set after 21:00, pickup before 06:00)
 *   4. Average score across the full window is reasonable
 *
 * Returns up to 2 net-specific windows (longer soak duration preferred).
 */
export function findNetFishingWindows(
  scoredForecasts: ScoredForecast[],
  timezone: string,
): BestWindow[] {
  if (scoredForecasts.length === 0) {return [];}

  const hasDanger = (idx: number) =>
    scoredForecasts[idx].reasons.some(r => r.tone === 'danger');

  const isSafeForDeployment = (idx: number): boolean =>
    idx < scoredForecasts.length
      && !hasDanger(idx)
      && scoredForecasts[idx].safetyScore >= 65;

  // Find candidate windows: (set hour, soak duration, pickup hour)
  const candidates: BestWindow[] = [];
  const SOAK_DURATIONS = [6, 7, 8]; // hours

  for (let setIdx = 0; setIdx < scoredForecasts.length; setIdx++) {
    if (!isSafeForDeployment(setIdx)) {continue;}

    for (const soakHours of SOAK_DURATIONS) {
      const pickupIdx = setIdx + soakHours;
      if (pickupIdx >= scoredForecasts.length) {continue;}

      if (!isSafeForDeployment(pickupIdx)) {continue;}

      // Calculate average score for the full soak window
      let sum = 0;
      let allOk = true;
      for (let j = 0; j <= soakHours; j++) {
        if (j < scoredForecasts.length) {
          sum += scoredForecasts[setIdx + j].score;
        } else {
          allOk = false;
          break;
        }
      }
      if (!allOk) {continue;}

      const avg = sum / (soakHours + 1);

      // Prefer overnight timing: set after 21:00, pickup before 06:00
      const setTime = scoredForecasts[setIdx].forecast.time;
      const pickupTime = scoredForecasts[pickupIdx].forecast.time;
      const setOvernight = isOvernightHour(setTime, timezone) || localHour(setTime, timezone) === 21;
      const pickupEarly = localHour(pickupTime, timezone) <= 5;
      const overnightBonus = (setOvernight && pickupEarly) ? 10 : 0;

      candidates.push({
        start: setIdx,
        len: soakHours + 1, // includes both set and pickup hours
        avg: avg + overnightBonus, // boost score for overnight timing
      });
    }
  }

  if (candidates.length === 0) {return [];}

  // Sort by adjusted avg (overnight bonus included), then by soak duration (longer preferred)
  const sorted = candidates
    .sort((a, b) => {
      const avgDiff = b.avg - a.avg;
      if (Math.abs(avgDiff) > 0.5) {return avgDiff;}
      return b.len - a.len;
    });

  // Pick top 2 non-overlapping windows
  const best: BestWindow[] = [];
  for (const c of sorted) {
    if (best.length >= 2) {break;}
    const overlaps = best.some(w =>
      c.start < w.start + w.len && c.start + c.len > w.start
    );
    if (!overlaps) {
      best.push(c);
    }
  }

  best.sort((a, b) => a.start - b.start);
  return best;
}

/**
 * Find best fishing windows (1–3 hours) from a list of scored forecasts.
 * Returns up to 3 non-overlapping windows, sorted by time.
 * Prefers the longest consistent window whose average is within 5 points of the best.
 *
 * When method='net', uses specialized net-specific window logic to find safe
 * deployment + retrieval pairs with multi-hour soak windows (6–8 hours).
 *
 * If the best window starts at the very beginning of the forecast (index 0),
 * the search widens to topAvg−15 to ensure at least one future alternative is
 * included when possible, so the user can plan ahead.
 *
 * Windows are only shown when the hours are free of danger-level conditions.
 * If every hour in the forecast has a danger reason, "No safe fishing periods" is shown.
 */
export function findBestWindows(
  scoredForecasts: ScoredForecast[],
  options?: { method?: FishingMethod; timezone?: string },
): BestWindow[] {
  // Delegate to net-specific logic when method='net'
  if (options?.method === 'net' && options?.timezone) {
    return findNetFishingWindows(scoredForecasts, options.timezone);
  }
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
