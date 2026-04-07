# Fishing Score

The Score page shows a per-hour fishing suitability rating from **0 %** (most dangerous / unfishable) to **100 %** (perfect conditions, fish guaranteed). Each row includes the time, three scores (Total, Safety, Fishing), and brief explanations split by category.

The algorithm is designed for **deep-water fishing (50–200 m)** on the exposed **Norwegian coast**, where the continuous Norwegian Coastal Current (NCC) often intersects with and overpowers standard tidal movements. The core philosophy is **"No current, no fish"** — water movement is the primary driver for feeding behaviour in deep-water predators such as Ling, Tusk, Cod, and Saithe.

The table only includes **hourly forecast rows** — it stops at the last 1-hour interval from MET Norway's Locationforecast (typically ~48 hours). Wave data from Barentswatch (3-hour intervals) is linearly interpolated to fill every hourly row.

---

## Algorithm design

Instead of hard if/else brackets, the algorithm uses **continuous mathematical functions** — Gaussian curves, sigmoids, and smooth interpolation — to produce a fine-grained, linear 0–100 % scale. Ten independent variables are each evaluated as a **0.0–1.0 factor**. The factors are split into two groups — **safety** and **fishing** — then multiplied within each group and combined:

```
safetyScore  = round( windF × waveF × lightF × wavePeriodF × 100 )
fishingScore = round( currentF × tideF × moonF × precipF × tempF × pressureF × 100 )
totalScore   = round( safetyScore × fishingScore / 100 )
```

This multiplicative structure means a single dangerous condition (factor → 0) drives the entire score toward 0 %, while truly excellent conditions require *all* factors to be high. The split lets users see at a glance whether a low score is due to unsafe weather or poor fishing conditions.

The "Why" column is also split by category — **Safety Why** shows reasons from the safety factors, and **Fishing Why** shows reasons from the fishing factors.

---

## Safety factors

### Variable 1: Wind Speed & Current Interaction (Safety + Drift)

Wind affects surface drift, which determines whether deep-water gear can maintain bottom contact.

#### Safety overrides

| Condition | Factor |
|---|---|
| Wind > 15 m/s or gusts > 22 m/s | → 0.00 (storm) |
| Wind > 12 m/s or gusts > 18 m/s | 0.05–0.25 (strong wind) |

#### Wind–current interaction

| Alignment | Effect |
|---|---|
| Wind opposing current (> 120° difference) | Positive — slows drift, improves bottom contact |
| Wind aligned with current (< 60°, > 5 m/s) | Negative — boat drifts too fast |

#### General wind curve

Below the safety threshold, the factor decreases smoothly from 1.0 (calm) toward 0.25 (12 m/s). Gusts above 10–12 m/s apply an additional multiplier (0.85–0.92).

### Variable 2: Wave Height (Gear Handling & Safety)

Wave height affects both gear handling efficiency at depth and vessel safety.

| Wave height | Factor |
|---|---|
| ≤ 0.5 m | 1.00 |
| 0.5–1.0 m | 0.60–1.00 (smooth sigmoid) |
| 1.0–1.5 m | 0.35–0.60 |
| 1.5–2.0 m | 0.05–0.35 (worse with wind) |
| > 2.0 m | → 0.00 (dangerous) |

Waves above 1.5 m combined with wind (gusts > 5 m/s) receive a halved factor due to breaking wave risk.

### Variable 3: Light & Time of Day

Deep-water fish migrate upward and feed more aggressively in low light. The factor peaks at dawn and dusk. Light affects both safety (visibility) and fishing (feeding behaviour), so separate contextual reasons are pushed to each category.

| Condition | Factor | Safety reason | Fishing reason |
|---|---|---|---|
| Civil twilight / Dawn / Dusk | 1.00 | Good visibility | Twilight — peak feeding |
| Overcast daylight | 0.85 | — | Overcast — fish active |
| Full daylight | 0.80 | — | — |
| Bright sun + clear sky | 0.70 | Clear sky | Bright sun — fish deep |
| Nautical twilight | 0.08–0.20 | Dark — poor visibility | Dark — low activity |
| **Night** | **0.00** | **Night — unsafe** | **Night — no feeding** |

### Variable 4: Wave Period (Comfort & Safety)

Longer wave periods mean more spread-out swells — safer and more comfortable for small boats. Short steep waves combined with big waves are dangerous and make gear handling difficult.

The penalty **scales with wave height** — short period on small waves is uncomfortable but not unsafe for a 21' boat. The full penalty only applies at 1.5 m+ wave height; between 1.0–1.5 m it ramps in gradually. Below 1.0 m wave height, wave period has no effect.

| Wave period | Factor (at full wave height) |
|---|---|
| ≥ 10 s | 1.00 (long comfortable swell) |
| 7–10 s | 0.85–1.00 (moderate) |
| 5–7 s | 0.60–0.85 (short, uncomfortable) |
| < 5 s | 0.30–0.60 (steep, dangerous chop) |

| Wave height | Period penalty scaling |
|---|---|
| ≤ 1.0 m | No penalty (period ignored) |
| 1.0–1.5 m | Partial penalty (linearly scaled) |
| ≥ 1.5 m | Full penalty |

---

## Fishing factors

### Variable 5: Ocean Current Speed (Base Score)

The primary fishing driver. A Gaussian curve centred at the **sweet spot of 0.4 m/s** (σ = 0.22) forms the base score.

| Current speed | Factor | Fishing meaning |
|---|---|---|
| 0.0–0.1 m/s | ~0.10–0.15 | "Dead water" — fish rest, bite rate very low |
| 0.15–0.24 m/s | 0.15–0.55 | Slow — some activity, sub-optimal |
| **0.25–0.55 m/s** | **0.80–1.00** | **Sweet spot** — strong feeding, manageable gear |
| 0.6–0.7 m/s | 0.55–0.70 | Gear drag increasing, lines bow ("S-curve" effect) |
| 0.8–1.0 m/s | 0.20–0.45 | Highly inefficient — nets flat, traps drift |
| > 1.0 m/s | → 0.00 | Unfishable — dangerous with wind |

When no current data is available, a neutral factor of 1.0 is used (no effect).

### Variable 6: Tidal Phase (Biological Modifier)

Even where coastal currents dominate, tidal phases dictate biological rhythms at depth and nutrient exchange along underwater structures.

| Tide phase | Factor | Rationale |
|---|---|---|
| **Rising tide** | 1.00 | Increasing hydrostatic pressure stimulates swim bladders, peak hunting aggression |
| **Falling tide** | 0.95 | Active water exchange, strong nutrient upwelling |
| Turning (±1h from Hi/Lo) | 0.85 | Movement slowing/starting |
| Approaching tide (±2h) | 0.75 | Moderate movement |
| **Slack tide** (exact Hi/Lo) | 0.55 | Water stalls — least productive phase |

When no tide data is available, a neutral 0.75 default is used.

### Variable 7: Moon Phase (Tidal Amplitude)

The moon phase controls the *strength* of tidal pull, reaching deeper into the water column during spring tides.

| Moon phase | Factor | Effect |
|---|---|---|
| New Moon / Full Moon (spring) | 0.95–1.00 | Strongest tidal pull, amplified deep-water movement |
| Waxing/Waning Gibbous/Crescent | 0.86–0.95 | Moderate pull |
| First Quarter / Last Quarter (neap) | 0.82 | Weakest deep-water movement, caps potential |

The factor follows a continuous cosine curve peaking at new and full moon.

### Variable 8: Precipitation (Minor)

| Condition | Factor |
|---|---|
| Dry or light (≤ 0.5 mm/h) | 1.00 |
| Moderate (0.5–2 mm/h) | 0.93 |
| Heavy (> 2 mm/h) | 0.85 |

### Variable 9: Sea Temperature (Minor)

| Condition | Factor |
|---|---|
| ≥ 3°C | 1.00 |
| < 3°C | 0.92 (reduced fish activity) |

### Variable 10: Barometric Pressure (Fish Activity)

Fish are sensitive to atmospheric pressure changes. Without trend data, the score is based on absolute value — moderate low pressure (typical of approaching weather) is ideal for activity.

| Pressure | Factor | Fishing meaning |
|---|---|---|
| 1010–1020 hPa | 1.00 | Ideal — moderate low, fish active |
| 1000–1010 hPa | 0.95 | Good — approaching low |
| 1020–1030 hPa | 0.90 | Slight penalty — high pressure, fish sluggish |
| < 1000 hPa | 0.88 | Storm-adjacent — fish may feed before front |
| > 1030 hPa | 0.82 | Strong stable high — fish inactive |

---

## Best fishing windows

The Score page highlights the **best fishing windows** — up to 2 non-overlapping 1–3 hour stretches with the highest average score. Each window is shown as a card with the average score, date/time range, and links to add the event to **Google Calendar**, **Outlook.com**, or download an **.ics** file (Apple Calendar, etc.).

Windowselection rules:
- Hours with any **danger-level** condition (⚠️ storm, dangerous seas, night, steep chop, etc.) are excluded — windows can only contain safe hours.
- Among eligible windows, the algorithm picks the longest stretch within 5 points of the best average, then the highest average.
- If *every* hour in the forecast has a danger condition, "No safe fishing periods" is shown.
- Windows are shown regardless of how low the total score is — even 5 % is shown if the hours are safe. This covers situations like dead current where fishing potential is low but weather is fine.

In the hourly table below, the **Total** score cells for hours within a best window are highlighted with a **blue border** so they're easy to spot.

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
- Barometric pressure trend (rising/falling) is not tracked — only the current value is used.
- Wind–current alignment requires both direction datasets; when either is missing, the interaction modifier is skipped.
- Wave data comes from Barentswatch Waveforecast and is only available where the nearest grid point is within 1 km.
- Wave period scoring only applies when waves exceed 1.0 m and scales to full effect at 1.5 m — calm seas get a neutral factor.
- The algorithm may be revised as real-world feedback is gathered.
