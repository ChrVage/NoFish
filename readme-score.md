# Fishing Score

The Score page shows a per-hour fishing suitability rating from **0 %** (worst) to **100 %** (best). Each row includes the time, the score, and a brief explanation of the factors that contributed.

The table only includes **hourly forecast rows** — it stops where MET Norway switches from 1-hour to 6-hour intervals (typically after ~2.5 days).

---

## How the score is calculated

Every hour starts at a **base score of 50** and is adjusted up or down by several independent factors. The final result is clamped to the 0–100 range.

### Wind speed

| Condition | Wind speed | Effect |
|---|---|---|
| Calm wind | ≤ 1 m/s | +5 |
| Light wind | 1–6 m/s | +10 |
| Moderate wind | 6–10 m/s | −5 |
| Strong wind | 10–15 m/s | −15 |
| Very strong wind | > 15 m/s | −25 |

### Gusts

| Condition | Gust speed | Effect |
|---|---|---|
| Gusty | > 12 m/s | −5 |

### Precipitation

| Condition | Amount | Effect |
|---|---|---|
| Dry | 0 mm | +5 |
| Trace | ≤ 0.5 mm | 0 |
| Light rain | 0.5–2 mm | −5 |
| Heavy rain | > 2 mm | −15 |

### Wave height

| Condition | Height | Effect |
|---|---|---|
| Calm seas | ≤ 0.5 m | +10 |
| Low waves | 0.5–1.0 m | +5 |
| Moderate | 1.0–1.5 m | 0 |
| Choppy | 1.5–2.5 m | −10 |
| Rough seas | > 2.5 m | −20 |

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

| Condition | Phase | Effect |
|---|---|---|
| Dawn / dusk | Daylight hour with civil twilight fraction > 10 % | +10 |
| Twilight | Dominant civil twilight | +10 |
| Daylight | Full daylight | +5 |
| Dark | Nautical twilight | −5 |
| Night | Astronomical night | −10 |

The Time column background colour reflects the sun phase — matching the Details page.

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
- Pressure trend (rising/falling) is not currently tracked; only the absolute value is used.
- Wave height data is only available for coastal locations where the ocean forecast grid point is within 1 km.
- The algorithm may be revised as real-world feedback is gathered.
