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
| **Air Temp** | °C | Air temperature at 2 m above ground. |

**Source:** [MET Norway Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) — ~2.5 km grid (HARMONIE-AROME model). Hourly data for the first ~48 hours; 6-hour intervals beyond that (NoFish trims the table at the last hourly row).

### Barentswatch Waveforecast

| Column | Unit | Description |
|---|---|---|
| **Wave Height** | m | **Significant wave height (Hs)** — the average height of the highest one-third of waves. This is the standard metric used in marine forecasting. In practice, roughly 1 in 10 waves will be ~1.3× Hs, and the maximum expected wave height in a given period can reach ~1.9× Hs. A "1.5 m" significant wave height means individual waves up to ~2.0 m are common and a ~2.9 m wave is statistically possible. Bold values are real data points; grey italic values are linearly interpolated between 3-hour data points. |
| **Wave Dir** | arrow | Mean direction the waves are travelling **from**. The arrow points in the direction the waves are heading. |

**Source:** [Barentswatch Waveforecast](https://www.barentswatch.no/bolgevarsel/) — ~4 km grid covering Norwegian coastal waters. Data arrives at 3-hour intervals; NoFish interpolates linearly to fill every hourly row. Interpolated values are shown in grey italic.

### Barentswatch Sea Current

| Column | Unit | Description |
|---|---|---|
| **Current Speed** | m/s | Surface ocean current speed. Values above ~0.5 m/s indicate strong current. For context, 0.25–0.55 m/s is considered ideal for deep-water fishing (enough water movement to trigger feeding, manageable for gear). |
| **Curr Dir** | arrow | Direction the current is flowing **towards**. The arrow points in the direction the water is moving. |

**Source:** [Barentswatch Sea Current](https://developer.barentswatch.no/) — ~800 m grid covering Norwegian coastal waters; hourly time steps. Accuracy is moderate — currents are highly sensitive to local bathymetry and wind conditions.

### MET Sea Temp

| Column | Unit | Description |
|---|---|---|
| **Sea Temp** | °C | Sea surface temperature from MET Norway's NorKyst800 ocean model. |

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

For detailed source ratings, grid resolutions, limitations, and known issues, see [readme-dataquality.md](readme-dataquality.md).

Key points:
- All external API calls are made **server-side** — no data exposed to the browser except the final merged result.
- Forecast data is cached in a Neon Postgres database to reduce API load and improve response times.
- The table is trimmed at the last MET hourly interval (~48 hours) to avoid showing low-confidence extended forecasts.
- Wave data is interpolated from 3-hour to 1-hour resolution; interpolated rows are visually distinguished.
- Ocean data is suppressed entirely when the nearest grid point is more than 1 km from the clicked location.

---

> See [readme-dataquality.md](readme-dataquality.md) for source ratings and limitations.
> See [readme-score.md](readme-score.md) for how these values feed into the fishing score.
> See [readme-technical.md](readme-technical.md) for API endpoints and tech stack.
