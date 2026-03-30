# Fishing Score

The Score page shows a per-hour fishing suitability rating from **0 %** (worst) to **100 %** (best). Each row includes the time, the score, and a brief explanation of the factors that contributed.

The table only includes **hourly forecast rows** — it stops at the last 1-hour interval from MET Norway's Locationforecast (typically ~48 hours). Wave data from Barentswatch (3-hour intervals) is linearly interpolated to fill every hourly row.

The algorithm is tuned for a **21-foot boat**. Safety is the primary concern — dangerous conditions hard-cap the score regardless of how good the fishing factors are.

---

## Two-layer scoring

### 1. Safety caps (hard ceilings)

Safety caps impose a **maximum possible score**. When multiple caps apply the lowest one wins. These cannot be overridden by good fishing conditions.

Rows that trigger a safety cap show a ⚠️ prefix in the *Why* column.

### 2. Fishing-quality factors (base ± adjustments)

Every hour starts at a **base score of 50** and is adjusted up or down by independent comfort and fishing-quality factors. The result is clamped to 0–100 and then capped by the safety ceiling.

---

## Safety caps

### Darkness

A 21-ft boat at night risks hitting ropes, crab-pot lines, debris, and unlit objects. No radar, limited navigation lights.

| Condition | Phase | Cap |
|---|---|---|
| ⚠️ Night — unsafe | Astronomical night (dominant) | 5 % |
| ⚠️ Dark — poor visibility | Nautical twilight (dominant) | 15 % |

### Wave height (21-ft boat limits)

| Condition | Waves | Gusts | Cap |
|---|---|---|---|
| ⚠️ Dangerous seas | > 2.0 m | any | 5 % |
| ⚠️ High waves + wind | > 1.5 m | > 5 m/s | 10 % |
| ⚠️ High waves | > 1.5 m | ≤ 5 m/s (pure swell) | 25 % |
| ⚠️ Waves + gusts | > 1.0 m | > 10 m/s | 15 % |

The interaction between waves and gusts is critical: gusts create steep, breaking waves on top of swell which are far more dangerous than smooth swell alone.

### Gusts

| Condition | Gust speed | Cap |
|---|---|---|
| ⚠️ Dangerous gusts | > 20 m/s | 5 % |
| ⚠️ Strong gusts | > 15 m/s | 15 % |

### Sustained wind

| Condition | Wind speed | Cap |
|---|---|---|
| ⚠️ Storm wind | > 15 m/s | 10 % |
| ⚠️ Strong wind | > 12 m/s | 25 % |

---

## Fishing-quality factors

These only fire when the corresponding metric is **below** its safety threshold.

### Wind speed

| Condition | Wind speed | Effect |
|---|---|---|
| Calm wind | ≤ 1 m/s | +5 |
| Light wind | 1–5 m/s | +10 |
| Moderate breeze | 5–8 m/s | +3 |
| Moderate wind | 8–12 m/s | −8 |

### Gusts

| Condition | Gust speed | Effect |
|---|---|---|
| Gusty | 10–15 m/s | −5 |

### Precipitation

| Condition | Amount | Effect |
|---|---|---|
| Dry | 0 mm | +5 |
| Trace | ≤ 0.5 mm | 0 |
| Light rain | 0.5–2 mm | −5 |
| Heavy rain | > 2 mm | −15 |

### Wave height (comfort)

| Condition | Height | Effect |
|---|---|---|
| Calm seas | ≤ 0.3 m | +10 |
| Low waves | 0.3–0.7 m | +5 |
| Neutral | 0.7–1.0 m | 0 |
| Choppy | 1.0–1.5 m | −10 |

### Cloud cover

| Condition | Coverage | Effect |
|---|---|---|
| Overcast | 50–90 % | +5 |
| Clear sky | < 20 % | −3 |

Overcast skies reduce light penetration, which tends to make fish feed more confidently near the surface.

### Tide phase

| Condition | Phase | Effect |
|---|---|---|
| Moving tide | Rising / Falling | +10 |
| Tide turning | Near high or low (e.g. Hi−1, Lo+1) | +8 |
| Slack tide | At high or low turn | −5 |

Moving water carries bait and activates fish. Slack water at the peak of a high or low is generally the least productive phase.

### Sun phase

Only applied when the hour is **not** already safety-capped for darkness.

| Condition | Phase | Effect |
|---|---|---|
| Dawn / dusk | Daylight hour with civil twilight fraction > 10 % | +10 |
| Twilight | Dominant civil twilight | +10 |
| Daylight | Full daylight | +5 |

### Atmospheric pressure

| Condition | Pressure | Effect |
|---|---|---|
| Stable high | 1015–1030 hPa | +3 |
| Low pressure | < 1000 hPa | −5 |

---

## Score colour coding

| Score range | Colour | Meaning |
|---|---|---|
| 75–100 % | Green | Excellent |
| 55–74 % | Light green | Good |
| 40–54 % | Amber | Fair |
| 25–39 % | Orange | Poor |
| 0–24 % | Red | Bad |

---

## Limitations

- The score is a **rough heuristic** — it does not account for species, bait, local topography, or seasonal migration.
- Boat size is fixed at 21 ft; larger vessels may tolerate higher seas and night operation.
- Pressure trend (rising/falling) is not currently tracked; only the absolute value is used.
- Wave height data comes from Barentswatch Waveforecast and is only available for coastal locations where the nearest grid point is within 1 km. Interpolated values are used for scoring but may miss sudden changes between data points.
- The algorithm may be revised as real-world feedback is gathered.
