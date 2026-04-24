import { describe, it, expect } from 'vitest';
import {
  computeFishingScore,
  findBestWindows,
  getScoreColor,
  getScoreBg,
  getDepthProfile,
  recommendFishingMethods,
  type ScoredForecast,
} from './fishingScore';
import type { HourlyForecast } from '@/types/weather';

// ── Helper: build a minimal HourlyForecast with overrides ───────────────────

function mkForecast(overrides: Partial<HourlyForecast> = {}): HourlyForecast {
  return {
    time: '2025-07-15T12:00:00Z',
    ...overrides,
  };
}

// ── Helper: extract danger-tone reasons ─────────────────────────────────────

function dangerTexts(reasons: { text: string; tone: string }[]): string[] {
  return reasons.filter(r => r.tone === 'danger').map(r => r.text);
}

// ═════════════════════════════════════════════════════════════════════════════
// computeFishingScore
// ═════════════════════════════════════════════════════════════════════════════

describe('computeFishingScore', () => {
  // ── Score boundaries ────────────────────────────────────────────────────

  it('returns score 0–100 for any input', () => {
    const { score, safetyScore, fishingScore } = computeFishingScore(mkForecast());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(safetyScore).toBeGreaterThanOrEqual(0);
    expect(safetyScore).toBeLessThanOrEqual(100);
    expect(fishingScore).toBeGreaterThanOrEqual(0);
    expect(fishingScore).toBeLessThanOrEqual(100);
  });

  it('returns integer scores (rounded)', () => {
    const { score, safetyScore, fishingScore } = computeFishingScore(mkForecast({
      windSpeed: 4, currentSpeed: 0.35, waveHeight: 0.6,
    }));
    expect(Number.isInteger(score)).toBe(true);
    expect(Number.isInteger(safetyScore)).toBe(true);
    expect(Number.isInteger(fishingScore)).toBe(true);
  });

  // ── 1. Current speed factor ─────────────────────────────────────────────

  describe('current speed', () => {
    it('sweet spot (0.3–0.5 m/s) yields high fishing score', () => {
      const { fishingScore, reasons } = computeFishingScore(mkForecast({ currentSpeed: 0.40 }));
      expect(fishingScore).toBeGreaterThanOrEqual(60);
      expect(reasons.some(r => r.text.includes('sweet spot'))).toBe(true);
    });

    it('dead water (< 0.1 m/s) penalises heavily', () => {
      const { fishingScore, reasons } = computeFishingScore(mkForecast({ currentSpeed: 0.05 }));
      expect(fishingScore).toBeLessThanOrEqual(30);
      expect(reasons.some(r => r.text.includes('dead water'))).toBe(true);
    });

    it('unfishable current (> 1.0 m/s) generates danger', () => {
      const { reasons } = computeFishingScore(mkForecast({ currentSpeed: 1.2 }));
      const dangers = dangerTexts(reasons);
      expect(dangers.some(t => t.includes('unfishable'))).toBe(true);
    });

    it('no current data → cautious default (penalised)', () => {
      const withCurrent = computeFishingScore(mkForecast({ currentSpeed: 0.40 }));
      const withoutCurrent = computeFishingScore(mkForecast());
      // Without current data, the score should be noticeably lower
      // than with an ideal current — "no current, no fish"
      expect(withoutCurrent.fishingScore).toBeLessThan(withCurrent.fishingScore);
      expect(withoutCurrent.fishingScore).toBeLessThanOrEqual(55);
    });
  });

  // ── 2. Wind & drift ────────────────────────────────────────────────────

  describe('wind', () => {
    it('storm wind (>15 m/s) drives safety score to 0', () => {
      const result = computeFishingScore(mkForecast({ windSpeed: 18, windGust: 25 }));
      expect(result.safetyScore).toBeLessThanOrEqual(5);
      expect(dangerTexts(result.reasons).some(t => t.includes('Storm'))).toBe(true);
    });

    it('strong wind (12–15 m/s) produces danger reason', () => {
      const result = computeFishingScore(mkForecast({ windSpeed: 13 }));
      expect(dangerTexts(result.reasons).some(t => t.includes('Strong wind'))).toBe(true);
    });

    it('light wind (≤3 m/s) is good for safety', () => {
      const { reasons } = computeFishingScore(mkForecast({ windSpeed: 2 }));
      expect(reasons.some(r => r.text.includes('Light wind') && r.tone === 'good')).toBe(true);
    });

    it('sustained strong wind with heavy gusts compounds penalty', () => {
      const result = computeFishingScore(mkForecast({ windSpeed: 11, windGust: 17 }));
      expect(dangerTexts(result.reasons).some(t => t.includes('Sustained') && t.includes('gusts'))).toBe(true);
    });

    it('wind opposing current gives bonus when moderate', () => {
      const { reasons } = computeFishingScore(mkForecast({
        windSpeed: 5,
        windDirection: 0,    // wind from north
        currentDirection: 0, // current flowing north → wind-to is 180°, diff > 120°
        currentSpeed: 0.3,
      }));
      expect(reasons.some(r => r.text.includes('opposing current') && r.tone === 'good')).toBe(true);
    });

    it('wind against strong current generates danger', () => {
      const result = computeFishingScore(mkForecast({
        windSpeed: 10,
        windDirection: 0,
        currentDirection: 0,
        currentSpeed: 0.8,
      }));
      const allTexts = result.reasons.map(r => r.text);
      expect(allTexts.some(t => t.includes('current') || t.includes('steep chop'))).toBe(true);
    });
  });

  // ── 3. Tide phase ──────────────────────────────────────────────────────

  describe('tide phase', () => {
    it('rising tide is best for fishing', () => {
      const { reasons } = computeFishingScore(mkForecast({ tidePhase: 'Rising' }));
      expect(reasons.some(r => r.text.includes('Rising tide') && r.tone === 'good')).toBe(true);
    });

    it('slack tide penalises', () => {
      const { reasons } = computeFishingScore(mkForecast({ tidePhase: 'Hi (13:18)' }));
      expect(reasons.some(r => r.text.includes('Slack tide') && r.tone === 'bad')).toBe(true);
    });

    it('turning tide (±1h) is moderate', () => {
      const rising = computeFishingScore(mkForecast({ tidePhase: 'Rising' }));
      const turning = computeFishingScore(mkForecast({ tidePhase: 'Hi+1h' }));
      expect(turning.fishingScore).toBeLessThan(rising.fishingScore);
    });
  });

  // ── 4. Moon phase ─────────────────────────────────────────────────────

  describe('moon phase', () => {
    it('new/full moon (spring tide) gives good reason', () => {
      const { reasons } = computeFishingScore(mkForecast({ moonPhase: '🌑 New Moon' }));
      expect(reasons.some(r => r.text.includes('Spring tide'))).toBe(true);
    });

    it('quarter moon (neap) gives bad reason', () => {
      const { reasons } = computeFishingScore(mkForecast({ moonPhase: '🌗 Last Quarter' }));
      expect(reasons.some(r => r.text.includes('Neap tide'))).toBe(true);
    });
  });

  // ── 5. Light / sun phase ──────────────────────────────────────────────

  describe('light', () => {
    it('night → safety 0, danger reasons', () => {
      const result = computeFishingScore(mkForecast({
        sunPhaseSegments: [{ phase: 'night', fraction: 1.0 }],
      }));
      const dangers = dangerTexts(result.reasons);
      expect(dangers.some(t => t.includes('Night'))).toBe(true);
      // Light factor drives safety very low
      expect(result.safetyScore).toBeLessThanOrEqual(5);
    });

    it('civil twilight is peak feeding time', () => {
      const { reasons } = computeFishingScore(mkForecast({
        sunPhaseSegments: [{ phase: 'civil', fraction: 1.0 }],
      }));
      expect(reasons.some(r => r.text.includes('Twilight') && r.text.includes('peak feeding'))).toBe(true);
    });

    it('bright midday with clear sky penalises fishing', () => {
      const { reasons } = computeFishingScore(mkForecast({
        sunPhaseSegments: [{ phase: 'day', fraction: 1.0 }],
        cloudCover: 10,
      }));
      expect(reasons.some(r => r.text.includes('fish deep') && r.tone === 'bad')).toBe(true);
    });

    it('bright midday at very deep spots is not treated as negative', () => {
      const { reasons } = computeFishingScore(mkForecast({
        sunPhaseSegments: [{ phase: 'day', fraction: 1.0 }],
        cloudCover: 10,
      }), 500);
      expect(reasons.some(r => r.text.includes('Bright sun less relevant at depth') && r.tone === 'good')).toBe(true);
      expect(reasons.some(r => r.text.includes('fish deep') && r.tone === 'bad')).toBe(false);
    });

    it('overcast day boosts fishing', () => {
      const { reasons } = computeFishingScore(mkForecast({
        sunPhaseSegments: [{ phase: 'day', fraction: 1.0 }],
        cloudCover: 70,
      }));
      expect(reasons.some(r => r.text.includes('Overcast') && r.text.includes('active'))).toBe(true);
    });
  });

  // ── 6. Wave height ────────────────────────────────────────────────────

  describe('wave height', () => {
    it('calm seas (≤0.5m) → full safety factor', () => {
      const { reasons } = computeFishingScore(mkForecast({ waveHeight: 0.3 }));
      expect(reasons.some(r => r.text.includes('Calm seas'))).toBe(true);
    });

    it('dangerous seas (>2.5m) → near-zero safety', () => {
      const result = computeFishingScore(mkForecast({ waveHeight: 3.0 }));
      expect(dangerTexts(result.reasons).some(t => t.includes('Dangerous seas'))).toBe(true);
      expect(result.safetyScore).toBeLessThanOrEqual(15);
    });

    it('waves + wind compounds penalty', () => {
      const wavesOnly = computeFishingScore(mkForecast({ waveHeight: 1.6 }));
      const wavesAndWind = computeFishingScore(mkForecast({ waveHeight: 1.6, windSpeed: 8, windGust: 10 }));
      expect(wavesAndWind.safetyScore).toBeLessThan(wavesOnly.safetyScore);
    });
  });

  // ── 7. Precipitation ──────────────────────────────────────────────────

  describe('precipitation', () => {
    it('heavy rain penalises fishing', () => {
      const { reasons } = computeFishingScore(mkForecast({ precipitation: 4 }));
      expect(reasons.some(r => r.text.includes('Heavy rain'))).toBe(true);
    });

    it('no rain has no penalty', () => {
      const dry = computeFishingScore(mkForecast({ precipitation: 0 }));
      const wet = computeFishingScore(mkForecast({ precipitation: 4 }));
      expect(dry.fishingScore).toBeGreaterThanOrEqual(wet.fishingScore);
    });
  });

  // ── 8. Sea temperature ────────────────────────────────────────────────

  describe('sea temperature', () => {
    it('cold sea (<3°C) penalises', () => {
      const { reasons } = computeFishingScore(mkForecast({ seaTemperature: 2 }));
      expect(reasons.some(r => r.text.includes('Cold sea'))).toBe(true);
    });
  });

  // ── 9. Barometric pressure ────────────────────────────────────────────

  describe('pressure', () => {
    it('ideal pressure (1010–1020) → good reason', () => {
      const { reasons } = computeFishingScore(mkForecast({ pressure: 1015 }));
      expect(reasons.some(r => r.text.includes('Ideal pressure') && r.tone === 'good')).toBe(true);
    });

    it('strong high (>1030) → fish inactive', () => {
      const { reasons } = computeFishingScore(mkForecast({ pressure: 1035 }));
      expect(reasons.some(r => r.text.includes('fish inactive'))).toBe(true);
    });

    it('low pressure → fish active', () => {
      const { reasons } = computeFishingScore(mkForecast({ pressure: 1005 }));
      expect(reasons.some(r => r.text.includes('fish active'))).toBe(true);
    });
  });

  // ── 10. Wave period ───────────────────────────────────────────────────

  describe('wave period', () => {
    it('steep chop with big waves produces danger', () => {
      const result = computeFishingScore(mkForecast({ waveHeight: 2.0, wavePeriod: 4 }));
      expect(dangerTexts(result.reasons).some(t => t.includes('Steep chop'))).toBe(true);
    });

    it('long swell with moderate waves is comfortable', () => {
      const { reasons } = computeFishingScore(mkForecast({ waveHeight: 1.5, wavePeriod: 12 }));
      expect(reasons.some(r => r.text.includes('Long swell'))).toBe(true);
    });

    it('long-period swell improves safety for marginally high waves', () => {
      const shortPeriod = computeFishingScore(mkForecast({ waveHeight: 1.2, wavePeriod: 5, windSpeed: 3 }));
      const longPeriod = computeFishingScore(mkForecast({ waveHeight: 1.2, wavePeriod: 12, windSpeed: 3 }));
      expect(longPeriod.safetyScore).toBeGreaterThan(shortPeriod.safetyScore);
      expect(longPeriod.reasons.some(r => r.text.includes('softens wave risk') && r.tone === 'good')).toBe(true);
    });

    it('wave period ignored when seas calm (<1m)', () => {
      const { reasons } = computeFishingScore(mkForecast({ waveHeight: 0.5, wavePeriod: 3 }));
      // Steep chop reason should NOT appear because waves are small
      expect(dangerTexts(reasons).some(t => t.includes('Steep chop'))).toBe(false);
    });
  });

  // ── Combined scoring ──────────────────────────────────────────────────

  describe('combined score', () => {
    it('perfect conditions → high score', () => {
      const { score } = computeFishingScore(mkForecast({
        currentSpeed: 0.40,
        windSpeed: 2,
        waveHeight: 0.3,
        tidePhase: 'Rising',
        pressure: 1015,
        precipitation: 0,
        sunPhaseSegments: [{ phase: 'civil', fraction: 1.0 }],
        moonPhase: '🌑 New Moon',
      }));
      expect(score).toBeGreaterThanOrEqual(65);
    });

    it('worst conditions → near-zero score', () => {
      const { score } = computeFishingScore(mkForecast({
        windSpeed: 20,
        windGust: 28,
        waveHeight: 4.0,
        wavePeriod: 3,
        currentSpeed: 1.5,
        sunPhaseSegments: [{ phase: 'night', fraction: 1.0 }],
        tidePhase: 'Hi (13:00)',
        pressure: 1035,
      }));
      expect(score).toBe(0);
    });

    it('safety score reflects only safety factors', () => {
      // Good safety, bad fishing → safetyScore high, fishingScore low
      const result = computeFishingScore(mkForecast({
        windSpeed: 2,
        waveHeight: 0.3,
        sunPhaseSegments: [{ phase: 'day', fraction: 1.0 }],
        currentSpeed: 0.05, // dead water
        tidePhase: 'Hi (13:00)', // slack
        pressure: 1035,
      }));
      expect(result.safetyScore).toBeGreaterThan(result.fishingScore);
    });
  });

  // ── Danger reason generation ──────────────────────────────────────────

  describe('danger reasons', () => {
    it('multiple dangers accumulate', () => {
      const result = computeFishingScore(mkForecast({
        windSpeed: 16,
        windGust: 22,
        waveHeight: 3.0,
        sunPhaseSegments: [{ phase: 'night', fraction: 1.0 }],
      }));
      const dangers = dangerTexts(result.reasons);
      expect(dangers.length).toBeGreaterThanOrEqual(3);
    });

    it('danger reasons have correct category', () => {
      const result = computeFishingScore(mkForecast({
        windSpeed: 16,
        waveHeight: 3.0,
        currentSpeed: 1.2,
      }));
      const safetyDangers = result.reasons.filter(r => r.tone === 'danger' && r.category === 'safety');
      const fishingDangers = result.reasons.filter(r => r.tone === 'danger' && r.category === 'fishing');
      expect(safetyDangers.length).toBeGreaterThanOrEqual(1); // wind/waves
      expect(fishingDangers.length).toBeGreaterThanOrEqual(1); // unfishable current
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// findBestWindows
// ═════════════════════════════════════════════════════════════════════════════

describe('findBestWindows', () => {
  function mkScored(scores: number[], dangerIndices: number[] = []): ScoredForecast[] {
    return scores.map((score, i) => ({
      forecast: mkForecast({ time: `2025-07-15T${String(6 + i).padStart(2, '0')}:00:00Z` }),
      score,
      safetyScore: score,
      fishingScore: score,
      reasons: dangerIndices.includes(i)
        ? [{ text: 'danger', tone: 'danger' as const, category: 'safety' as const }]
        : [],
    }));
  }

  it('returns empty for empty input', () => {
    expect(findBestWindows([])).toEqual([]);
  });

  it('finds single best hour', () => {
    const windows = findBestWindows(mkScored([20, 80, 30]));
    expect(windows.length).toBeGreaterThanOrEqual(1);
    expect(windows[0].start).toBe(1);
  });

  it('prefers longer window within 5-point tolerance', () => {
    // Hours: 70, 72, 71 → 3-hour window avg ~71 vs single hour 72
    const windows = findBestWindows(mkScored([70, 72, 71]));
    // Should prefer the 3-hour window since avg (71) is within 5 of best (72)
    expect(windows.some(w => w.len >= 2)).toBe(true);
  });

  it('skips hours with danger conditions', () => {
    // Hour 1 has danger, so best window avoids it
    const windows = findBestWindows(mkScored([80, 90, 80], [1]));
    expect(windows.every(w => {
      for (let j = 0; j < w.len; j++) {
        if (w.start + j === 1) {return false;}
      }
      return true;
    })).toBe(true);
  });

  it('returns empty when all hours have danger', () => {
    const windows = findBestWindows(mkScored([80, 90, 70], [0, 1, 2]));
    expect(windows).toEqual([]);
  });

  it('returns at most 3 windows', () => {
    const scores = [90, 30, 30, 30, 90, 30, 30, 30, 90];
    const windows = findBestWindows(mkScored(scores));
    expect(windows.length).toBeLessThanOrEqual(3);
  });

  it('windows are sorted by start time', () => {
    const scores = [90, 20, 20, 85];
    const windows = findBestWindows(mkScored(scores));
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].start).toBeGreaterThan(windows[i - 1].start);
    }
  });

  it('merges adjacent windows', () => {
    // All high scores → should merge into one window
    const windows = findBestWindows(mkScored([80, 82, 81]));
    // Could be one window of length 3
    const totalHours = windows.reduce((sum, w) => sum + w.len, 0);
    expect(totalHours).toBeGreaterThanOrEqual(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Score display helpers
// ═════════════════════════════════════════════════════════════════════════════

describe('getScoreColor', () => {
  it('returns green for high scores (≥70)', () => {
    expect(getScoreColor(70)).toContain('166534');
    expect(getScoreColor(100)).toContain('166534');
  });

  it('returns red for low scores (<20)', () => {
    expect(getScoreColor(0)).toContain('991b1b');
    expect(getScoreColor(15)).toContain('991b1b');
  });

  it('covers all score ranges', () => {
    for (let s = 0; s <= 100; s += 10) {
      expect(getScoreColor(s)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('getScoreBg', () => {
  it('returns green bg for high scores', () => {
    expect(getScoreBg(80)).toContain('f0fdf4');
  });

  it('returns red bg for low scores', () => {
    expect(getScoreBg(10)).toContain('fef2f2');
  });

  it('covers all score ranges', () => {
    for (let s = 0; s <= 100; s += 10) {
      expect(getScoreBg(s)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Depth profile
// ═════════════════════════════════════════════════════════════════════════════

describe('getDepthProfile', () => {
  it('returns default profile when depth is undefined', () => {
    const dp = getDepthProfile(undefined);
    expect(dp.currentMu).toBe(0.40);
    expect(dp.currentSigma).toBe(0.22);
  });

  it('shallow water (<30m) peaks at lower current speed', () => {
    const dp = getDepthProfile(20);
    expect(dp.currentMu).toBe(0.25);
    expect(dp.tideSpread).toBe(1.0);
  });

  it('deep water (>400m) peaks at higher current speed', () => {
    const dp = getDepthProfile(500);
    expect(dp.currentMu).toBe(0.50);
    expect(dp.dawnDuskBonus).toBe(0.10);
  });

  it('handles negative elevation (depth below sea level)', () => {
    const dp = getDepthProfile(-150);
    expect(dp.currentMu).toBe(0.40); // 100–200 m bracket
  });
});

describe('depth-adaptive scoring', () => {
  it('shallow water favours slower current', () => {
    const f = mkForecast({ currentSpeed: 0.25 });
    const shallow = computeFishingScore(f, 20);
    const deep = computeFishingScore(f, 150);
    // 0.25 m/s is the shallow sweet spot but below the deep sweet spot
    expect(shallow.fishingScore).toBeGreaterThan(deep.fishingScore);
  });

  it('deep water favours faster current', () => {
    const f = mkForecast({ currentSpeed: 0.45 });
    const shallow = computeFishingScore(f, 20);
    const deep = computeFishingScore(f, 150);
    // 0.45 m/s is above the shallow sweet spot but near the deep sweet spot
    expect(deep.fishingScore).toBeGreaterThan(shallow.fishingScore);
  });

  it('tide phase matters more in shallow water', () => {
    const rising = mkForecast({ tidePhase: 'Rising' });
    const slack = mkForecast({ tidePhase: 'Hi (13:00)' });
    const shallowRising = computeFishingScore(rising, 20);
    const shallowSlack = computeFishingScore(slack, 20);
    const deepRising = computeFishingScore(rising, 500);
    const deepSlack = computeFishingScore(slack, 500);
    const shallowDiff = shallowRising.fishingScore - shallowSlack.fishingScore;
    const deepDiff = deepRising.fishingScore - deepSlack.fishingScore;
    expect(shallowDiff).toBeGreaterThan(deepDiff);
  });

  it('no depth passes through without error', () => {
    const { score } = computeFishingScore(mkForecast({ currentSpeed: 0.40 }));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('tuning compatibility', () => {
  it('boat size changes safety, not fishing logic', () => {
    const f = mkForecast({ windSpeed: 12.5, windGust: 18, waveHeight: 1.4, currentSpeed: 0.35 });
    const smallBoat = computeFishingScore(f, { boat: '15-19', fish: 'general' });
    const defaultBoat = computeFishingScore(f, { boat: '20-24', fish: 'general' });

    expect(smallBoat.safetyScore).toBeLessThan(defaultBoat.safetyScore);
    expect(smallBoat.fishingScore).toBe(defaultBoat.fishingScore);
  });

  it('species tuning changes fishing preference, not safety', () => {
    const f = mkForecast({ currentSpeed: 0.24, windSpeed: 5, waveHeight: 0.8 });
    const general = computeFishingScore(f, { fish: 'general', boat: '20-24' });
    const mackerel = computeFishingScore(f, { fish: 'mackerel', boat: '20-24' });

    expect(mackerel.fishingScore).toBeGreaterThan(general.fishingScore);
    expect(mackerel.safetyScore).toBe(general.safetyScore);
  });

  it('pollock supports multi-depth behavior', () => {
    const shallowCurrent = computeFishingScore(mkForecast({ currentSpeed: 0.25 }), { fish: 'pollock', boat: '20-24' });
    const deeperCurrent = computeFishingScore(mkForecast({ currentSpeed: 0.45 }), { fish: 'pollock', boat: '20-24' });

    expect(shallowCurrent.fishingScore).toBeGreaterThanOrEqual(45);
    expect(deeperCurrent.fishingScore).toBeGreaterThanOrEqual(45);
  });
});

describe('recommendFishingMethods', () => {
  it('returns ranked method scores with two recommendations', () => {
    const scored: ScoredForecast[] = Array.from({ length: 24 }).map((_, i) => ({
      forecast: mkForecast({
        time: `2026-01-01T${String(i).padStart(2, '0')}:00:00Z`,
        currentSpeed: 0.35,
        windSpeed: 5,
        waveHeight: 0.8,
      }),
      score: 65,
      safetyScore: 70,
      fishingScore: 75,
      reasons: [],
    }));

    const methods = recommendFishingMethods(scored, 'Europe/Oslo', 'cod');
    expect(methods).toHaveLength(4);
    expect(methods.filter((m) => m.recommended)).toHaveLength(2);
    expect(methods[0].score).toBeGreaterThanOrEqual(methods[1].score);
  });

  it('penalizes net score when morning after is not calm', () => {
    const scored: ScoredForecast[] = Array.from({ length: 36 }).map((_, i) => ({
      forecast: mkForecast({
        time: `2026-01-${i < 24 ? '01' : '02'}T${String(i % 24).padStart(2, '0')}:00:00Z`,
        currentSpeed: 0.3,
        windSpeed: i >= 29 && i <= 34 ? 12 : 5,
        waveHeight: i >= 29 && i <= 34 ? 1.8 : 0.8,
      }),
      score: 58,
      safetyScore: i >= 29 && i <= 34 ? 45 : 70,
      fishingScore: 72,
      reasons: [],
    }));

    const methods = recommendFishingMethods(scored, 'Europe/Oslo', 'general');
    const net = methods.find((m) => m.method === 'net');
    expect(net).toBeDefined();
    expect(net?.score).toBeLessThan(60);
  });
});
