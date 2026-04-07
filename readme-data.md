# NoFish — Data Column Reference

Descriptions of every column shown on the **Details** and **Tide** pages, with notes on how the values relate to real-world conditions.

---

## Details Page — Forecast Table

Columns are grouped by API source. Ocean columns (wave, current, sea temp, tide) are only shown for coastal locations where the nearest Barentswatch grid point is within 1 km.

### MET Norway Locationforecast

| Column | Unit | Description |
|---|---|---|
| **Wind** | m/s | Sustained 10-minute mean wind speed (bold) followed by gust speed in parentheses. Gust is the expected strongest 3-second wind speed within the hour. |
| **Wind dir** | arrow | Direction the wind blows **from**. The arrow points in the direction the wind is heading. A north wind (from N) shows an arrow pointing south. |
| **Weather** | emoji | Weather symbol summarising precipitation type, cloud cover, and sky conditions for the next 1-hour period. |
| **Rain / Snow** | mm | Expected precipitation in the next hour. The column header switches between "Rain" and "Snow" based on the air temperature of the first forecast row. Zero precipitation is hidden. |
| **Temp** | °C | Air temperature at 2 m above ground. |
| **Pressure** | hPa | Air pressure at sea level. Used in the fishing score to assess fish activity — moderate low pressure (1010–1020 hPa) is ideal. |

**Source:** [MET Norway Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) — ~2.5 km grid (HARMONIE-AROME model). Hourly data for the first ~48 hours; 6-hour intervals beyond that (NoFish trims the table at the last hourly row).

### Barentswatch Waveforecast

| Column | Unit | Description |
|---|---|---|
| **Height** | m | **Significant wave height (Hs)** — the average height of the highest one-third of waves. This is the standard metric used in marine forecasting. In practice, roughly 1 in 10 waves will be ~1.3× Hs, and the maximum expected wave height in a given period can reach ~1.9× Hs. A "1.5 m" significant wave height means individual waves up to ~2.0 m are common and a ~2.9 m wave is statistically possible. Bold values are real data points; grey italic values are linearly interpolated between 3-hour data points. |
| **Dir** | arrow | Mean direction the waves are travelling **from**. The arrow points in the direction the waves are heading. |
| **Period** | s | **Peak wave period** — the time interval between dominant wave crests. Longer periods (≥ 10 s) indicate comfortable swell; short periods (< 5 s) indicate steep, dangerous chop. Used in the safety score, but only penalised when waves exceed 1.0 m (full penalty at 1.5 m+). Interpolated like wave height. |

**Source:** [Barentswatch Waveforecast](https://www.barentswatch.no/bolgevarsel/) — ~4 km grid covering Norwegian coastal waters. Data arrives at 3-hour intervals; NoFish interpolates linearly to fill every hourly row. Interpolated values are shown in grey italic.

### Barentswatch Sea Current

| Column | Unit | Description |
|---|---|---|
| **Current** | m/s | Surface ocean current speed. Values above ~0.5 m/s indicate strong current. For context, 0.25–0.55 m/s is considered ideal for deep-water fishing (enough water movement to trigger feeding, manageable for gear). |
| **Dir** | arrow | Direction the current is flowing **towards**. The arrow points in the direction the water is moving. |

**Source:** [Barentswatch Sea Current](https://developer.barentswatch.no/) — ~800 m grid covering Norwegian coastal waters; hourly time steps. Accuracy is moderate — currents are highly sensitive to local bathymetry and wind conditions.

### MET Sea Temp

| Column | Unit | Description |
|---|---|---|
| **Temp** | °C | Sea surface temperature from MET Norway's NorKyst800 ocean model. |

**Source:** [MET Norway Oceanforecast 2.0](https://api.met.no/weatherapi/oceanforecast/2.0/documentation) — ~800 m grid (NorKyst800 model), Norwegian coastal waters.

### Kartverket

| Column | Description |
|---|---|
| **Tide** | Tidal phase label relative to the nearest high/low event, e.g. "Hi (13:18)" at the peak, "Hi+1" one hour after high tide, "Falling" during ebb, "Lo-2" two hours before low tide. |

**Source:** [Kartverket Tide API](https://api.kartverket.no/sehavniva/) — based on the nearest tide gauge station.

### Calculated

| Column | Description |
|---|---|
| **Sun** | Sun phase for the hour: Daylight, Civil twilight, Nautical twilight, or Night. Transition times (sunrise, sunset) are shown in parentheses. The Time column background colour also reflects the sun phase — white for day, grey-blue for civil twilight, dark blue for nautical, black for night. |
| **Moon** | Current moon phase with emoji: 🌑 New Moon, 🌒 Waxing Crescent, 🌓 First Quarter, 🌔 Waxing Gibbous, 🌕 Full Moon, 🌖 Waning Gibbous, 🌗 Last Quarter, 🌘 Waning Crescent. |

Sun position is calculated from latitude, longitude, and UTC time. Moon phase is an astronomical calculation based on the Julian date.

### Confidence indicators

The Details page shows a confidence legend above the table:
- **High** — first ~24 hours of the forecast; NWP model skill is strong
- **Medium** — hours 24–48; still useful but less precise
- **Low** — beyond 48 hours (not shown — table is trimmed at MET's last 1-hour interval)

Interpolated wave values (grey italic) inherently have lower confidence than real 3-hour data points.

---

## Tide Page

| Column | Unit | Description |
|---|---|---|
| **Time** | date + time | The predicted time of the high or low tide event, displayed in the local timezone of the selected location. |
| **Level** | cm | Water level relative to **chart datum (CD)** — the lowest astronomical tide level used on nautical charts. A value of 120 cm means the water surface is 120 cm above chart datum. The highest high tide and lowest low tide in the forecast period are shown in bold. |
| **Type** | — | Either **High** (peak water level) or **Low** (minimum water level). The first row may show "Last observation" with a Rising/Falling indicator based on the next predicted event. |

**Source:** [Kartverket – Se havnivå](https://kartverket.no/til-sjos/se-havniva/) — tide gauge station network along the Norwegian coast. Data is interpolated to the requested position from the nearest station; the station name and distance are shown in the page header.

### What affects the tide?

Tides are driven by the gravitational pull of the **moon** and **sun**. The moon has the strongest effect (~2.2× the sun's contribution) because of its proximity to Earth.

- **Spring tides** (largest tidal range) occur around new moon and full moon, when the sun and moon align.
- **Neap tides** (smallest tidal range) occur around first and last quarter, when the gravitational forces partially cancel out.
- **Local geography** (fjord shape, coastal topography, underwater ridges) strongly amplifies or dampens the tidal range. A fjord opening can funnel tidal flow, creating stronger currents at narrow points.

**Important:** Kartverket's values are **astronomical predictions only**. They do not include storm surge (the rise in water level caused by wind and low atmospheric pressure). During strong onshore winds or deep low-pressure systems, actual water levels can be 30–100 cm higher than predicted. Conversely, offshore winds and high pressure can push levels below the prediction. Always factor in current weather conditions.

---

## Data Quality and Sources

### Source Ratings

| Source | Data provided | Quality | Grid / point density | Next-hour accuracy | Next-week accuracy |
|---|---|---|---|---|---|
| [MET Norway Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) | Wind speed/direction/gust, temperature, precipitation, cloud cover, pressure | ⭐⭐⭐⭐⭐ | ~2.5 km grid (HARMONIE-AROME NWP model, Nordic domain) | Excellent | Good for 1–3 days; degrades noticeably after day 3–4, as with any NWP model |
| [MET Norway Oceanforecast 2.0](https://api.met.no/weatherapi/oceanforecast/2.0/documentation) | Sea surface temperature | ⭐⭐⭐⭐ | ~800 m grid (NorKyst800 ocean model) — Norwegian coastal waters only | Good | Reliable for 1–2 days |
| [Barentswatch Waveforecast](https://developer.barentswatch.no/) | Significant wave height, mean wave direction, peak period | ⭐⭐⭐⭐ | ~4 km grid — Norwegian coastal waters; 3-hour time steps (interpolated to hourly in the app) | Good | Reliable for 1–2 days; degrades faster than atmospheric fields |
| [Barentswatch Sea Current](https://developer.barentswatch.no/) | Current speed and direction | ⭐⭐⭐ | ~800 m grid — Norwegian coastal waters; hourly time steps | Moderate | Limited to 1–2 days; highly sensitive to local conditions |
| [Kartverket Tide API](https://api.kartverket.no/sehavniva/) | High/low tide event times and heights (cm above chart datum) | ⭐⭐⭐⭐⭐ | Tide gauge station network along the Norwegian coast; interpolated to requested position | Excellent | Excellent — astronomical tides are deterministic and accurate weeks to years ahead |
| [Nominatim / OpenStreetMap](https://nominatim.org/) | Place name from coordinates (reverse geocoding) | ⭐⭐⭐⭐ | N/A | N/A | N/A |

### Forecast Confidence

The Details page shows a confidence legend above the table (High › Medium › Low). The table is trimmed at the last 1-hour interval from MET's Locationforecast (typically ~48 hours), so only higher-confidence hourly data is displayed.

Beyond ~3 days the underlying NWP models are essentially providing climatological averages rather than genuine forecasts.

### Key Limitations

**Ocean data is coastal only.**
Barentswatch wave and current models cover Norwegian coastal waters. MET Norway's Oceanforecast (used for sea temperature) also covers coastal waters. The app suppresses ocean data when the nearest Barentswatch grid point is more than 1 km from the clicked location — this catches both inland points and locations at the edge of the model domain. When ocean data is suppressed, tide and score pages are also hidden. The forecast table shows only weather columns.

**Wave data is interpolated.**
Barentswatch provides wave data at 3-hour intervals. The app linearly interpolates wave height, direction, and period to fill every hourly row. Interpolated values are displayed in grey italic to distinguish them from real data points. Between data points the interpolation is a reasonable approximation but cannot capture sudden changes.

**Tides are astronomical predictions only.**
Kartverket's tide API returns the predicted astronomical tide — the component driven by the moon and sun. Storm surge (meteorological tide) is not included. During strong onshore winds or low-pressure systems, actual water levels can differ significantly from the prediction. Skippers must account for local conditions themselves.

**Weather accuracy beyond day 3–4.**
All NWP (numerical weather prediction) models lose skill rapidly beyond 3–4 days. The app trims the table at MET's last 1-hour interval (~48 hours), which keeps the forecast well within the reliable window. NoFish data is one input — local knowledge, VHF weather broadcasts, and personal judgment matter equally.

**Forecast grid points vs. clicked point.**
Both MET and Barentswatch APIs snap the requested coordinates to their nearest internal grid point. The Details page shows the distance from your clicked point to the actual wave forecast grid point used (when within 1 km). On the map, a sky-blue dot and dashed line indicate the wave grid point location. If the grid point is more than 1 km away, the ocean forecast is considered unrepresentative and is dropped entirely.

**Nominatim coverage at sea.**
OpenStreetMap's reverse geocoder has variable coverage for open-water locations. The app uses a wide fallback chain (village → town → city → hamlet → bay → fjord → strait → sea → ocean → first segment of display name) before falling back to raw coordinates.

**Not a substitute for judgment.**
NoFish is not powered by AI and does not make recommendations. Every skipper on the Norwegian coast must use their own experience, local knowledge, and real intelligence before heading out on the water. The numbers here inform that decision — they do not replace it.

---

### General notes

- All external API calls are made **server-side** — no data exposed to the browser except the final merged result.
- Forecast data is cached in a Neon Postgres database to reduce API load and improve response times.
- The table is trimmed at the last MET hourly interval (~48 hours) to avoid showing low-confidence extended forecasts.
- Wave data is interpolated from 3-hour to 1-hour resolution; interpolated rows are visually distinguished.
- Ocean data is suppressed entirely when the nearest grid point is more than 1 km from the clicked location.

---

> See [readme-score.md](readme-score.md) for how these values feed into the fishing score.
> See [readme-technical.md](readme-technical.md) for API endpoints and tech stack.
