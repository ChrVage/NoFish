# Fishing Score

The Score page shows a per-hour fishing suitability rating from **0 %** (most dangerous / unfishable) to **100 %** (perfect conditions, fish guaranteed). Each row includes the time, the score, and a brief explanation of the contributing factors.

The algorithm is designed for **deep-water fishing (50–200 m)** on the exposed **Norwegian coast**, where the continuous Norwegian Coastal Current (NCC) often intersects with and overpowers standard tidal movements. The core philosophy is **"No current, no fish"** — water movement is the primary driver for feeding behaviour in deep-water predators such as Ling, Tusk, Cod, and Saithe.

The table only includes **hourly forecast rows** — it stops at the last 1-hour interval from MET Norway's Locationforecast (typically ~48 hours). Wave data from Barentswatch (3-hour intervals) is linearly interpolated to fill every hourly row.

---

## Algorithm design

Instead of hard if/else brackets, the algorithm uses **continuous mathematical functions** — Gaussian curves, sigmoids, and smooth interpolation — to produce a fine-grained, linear 0–100 % scale. Eight independent variables are each evaluated as a **0.0–1.0 factor**, then multiplied together and scaled to a percentage:

```
score = round( currentF × windF × tideF × moonF × lightF × waveF × precipF × tempF × 100 )
```

This multiplicative structure means a single dangerous condition (factor → 0) drives the entire score toward 0 %, while truly excellent conditions require *all* factors to be high.

---

## Variable 1: Ocean Current Speed (Base Score)

The primary driver. A Gaussian curve centred at the **sweet spot of 0.4 m/s** (σ = 0.22) forms the base score.

| Current speed | Factor | Fishing meaning |
|---|---|---|
| 0.0–0.1 m/s | ~0.10–0.15 | "Dead water" — fish rest, bite rate very low |
| 0.15–0.24 m/s | 0.15–0.55 | Slow — some activity, sub-optimal |
| **0.25–0.55 m/s** | **0.80–1.00** | **Sweet spot** — strong feeding, manageable gear |
| 0.6–0.7 m/s | 0.55–0.70 | Gear drag increasing, lines bow ("S-curve" effect) |
| 0.8–1.0 m/s | 0.20–0.45 | Highly inefficient — nets flat, traps drift |
| > 1.0 m/s | → 0.00 | Unfishable — dangerous with wind |

When no current data is available, a neutral 0.50 default is used.

---

## Variable 2: Wind Speed & Current Interaction (Safety + Drift)

Wind affects surface drift, which determines whether deep-water gear can maintain bottom contact.

### Safety overrides

| Condition | Factor |
|---|---|
| Wind > 15 m/s or gusts > 22 m/s | → 0.00 (storm) |
| Wind > 12 m/s or gusts > 18 m/s | 0.05–0.25 (strong wind) |

### Wind–current interaction

| Alignment | Effect |
|---|---|
| Wind opposing current (> 120° difference) | Positive — slows drift, improves bottom contact |
| Wind aligned with current (< 60°, > 5 m/s) | Negative — boat drifts too fast |

### General wind curve

Below the safety threshold, the factor decreases smoothly from 1.0 (calm) toward 0.25 (12 m/s). Gusts above 10–12 m/s apply an additional multiplier (0.85–0.92).

---

## Variable 3: Tidal Phase (Biological Modifier)

Even where coastal currents dominate, tidal phases dictate biological rhythms at depth и nutrient exchange along underwater structures.

| Tide phase | Factor | Rationale |
|---|---|---|
| **Rising tide** | 1.00 | Increasing hydrostatic pressure stimulates swim bladders, peak hunting aggression |
| **Falling tide** | 0.95 | Active water exchange, strong nutrient upwelling |
| Turning (±1h from Hi/Lo) | 0.85 | Movement slowing/starting |
| Approaching tide (±2h) | 0.75 | Moderate movement |
| **Slack tide** (exact Hi/Lo) | 0.55 | Water stalls — least productive phase |

When no tide data is available, a neutral 0.75 default is used.

---

## Variable 4: Moon Phase (Tidal Amplitude)

The moon phase controls the *strength* of tidal pull, reaching deeper into the water column during spring tides.

| Moon phase | Factor | Effect |
|---|---|---|
| New Moon / Full Moon (spring) | 0.95–1.00 | Strongest tidal pull, amplified deep-water movement |
| Waxing/Waning Gibbous/Crescent | 0.86–0.95 | Moderate pull |
| First Quarter / Last Quarter (neap) | 0.82 | Weakest deep-water movement, caps potential |

The factor follows a continuous cosine curve peaking at new and full moon.

---

## Variable 5: Light & Time of Day

Deep-water fish migrate upward and feed more aggressively in low light. The factor peaks at dawn and dusk.

| Condition | Factor |
|---|---|
| Civil twilight / Dawn / Dusk | 1.00 (peak feeding) |
| Overcast daylight | 0.85 |
| Full daylight | 0.80 |
| Bright sun + clear sky | 0.70 |
| Nautical twilight | 0.08–0.20 (dangerous) |
| **Night** | **0.00** (unsafe) |

---

## Variable 6: Wave Height (Gear Handling & Safety)

Wave height affects both gear handling efficiency at depth and vessel safety.

| Wave height | Factor |
|---|---|
| ≤ 0.5 m | 1.00 |
| 0.5–1.0 m | 0.60–1.00 (smooth sigmoid) |
| 1.0–1.5 m | 0.35–0.60 |
| 1.5–2.0 m | 0.05–0.35 (worse with wind) |
| > 2.0 m | → 0.00 (dangerous) |

Waves above 1.5 m combined with wind (gusts > 5 m/s) receive a halved factor due to breaking wave risk.

---

## Variable 7: Precipitation (Minor)

| Condition | Factor |
|---|---|
| Dry or light (≤ 0.5 mm/h) | 1.00 |
| Moderate (0.5–2 mm/h) | 0.93 |
| Heavy (> 2 mm/h) | 0.85 |

---

## Variable 8: Sea Temperature (Minor)

| Condition | Factor |
|---|---|
| ≥ 3°C | 1.00 |
| < 3°C | 0.92 (reduced fish activity) |

---

## Score colour coding

| Score range | Colour | Meaning |
|---|---|---|
| 70–100 % | Green | Excellent |
| 50–69 % | Light green | Good |
| 35–49 % | Amber | Fair |
| 20–34 % | Orange | Poor |
| 0–19 % | Red | Dangerous / unfishable |

---

## Regional adaptability

The algorithm is modular. On the exposed Norwegian coast the ocean current variable dominates (0.4 m/s sweet spot). In other regions the weights can be adapted:

- **Deep inland fjords**: Tidal phase may dominate over coastal current. Current factor defaults to neutral when data is absent.
- **Northern Norway**: Extreme light variation (polar night / midnight sun) makes the light factor more impactful.
- **Sheltered bays**: Lower wave thresholds, tidal slack matters more.

---

## Limitations

- Designed for **deep-water fishing (50–200 m)** on exposed Norwegian coast; shallower or sheltered fishing behaves differently.
- Species, bait, local bottom topography, and seasonal migration are not modelled.
- Sea temperature trend (rising/falling) is not tracked — only the current value is used.
- Wind–current alignment requires both direction datasets; when either is missing, the interaction modifier is skipped.
- Wave data comes from Barentswatch Waveforecast and is only available where the nearest grid point is within 1 km.
- The algorithm may be revised as real-world feedback is gathered.
