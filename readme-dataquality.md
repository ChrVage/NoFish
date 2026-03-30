# NoFish — Data Quality

NoFish pulls from four external data sources. This document rates each on quality, spatial resolution, and forecast accuracy at different time horizons.

---

## Source Ratings

| Source | Data provided | Quality | Grid / point density | Next-hour accuracy | Next-week accuracy |
|---|---|---|---|---|---|
| [MET Norway Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) | Wind speed/direction/gust, temperature, precipitation, cloud cover, pressure | ⭐⭐⭐⭐⭐ | ~2.5 km grid (HARMONIE-AROME NWP model, Nordic domain) | Excellent | Good for 1–3 days; degrades noticeably after day 3–4, as with any NWP model |
| [MET Norway Oceanforecast 2.0](https://api.met.no/weatherapi/oceanforecast/2.0/documentation) | Sea surface temperature | ⭐⭐⭐⭐ | ~800 m grid (NorKyst800 ocean model) — Norwegian coastal waters only | Good | Reliable for 1–2 days |
| [Barentswatch Waveforecast](https://developer.barentswatch.no/) | Significant wave height, mean wave direction, peak period | ⭐⭐⭐⭐ | ~4 km grid — Norwegian coastal waters; 3-hour time steps (interpolated to hourly in the app) | Good | Reliable for 1–2 days; degrades faster than atmospheric fields |
| [Barentswatch Sea Current](https://developer.barentswatch.no/) | Current speed and direction | ⭐⭐⭐ | ~800 m grid — Norwegian coastal waters; hourly time steps | Moderate | Limited to 1–2 days; highly sensitive to local conditions |
| [Kartverket Tide API](https://api.kartverket.no/sehavniva/) | High/low tide event times and heights (cm above chart datum) | ⭐⭐⭐⭐⭐ | Tide gauge station network along the Norwegian coast; interpolated to requested position | Excellent | Excellent — astronomical tides are deterministic and accurate weeks to years ahead |
| [Nominatim / OpenStreetMap](https://nominatim.org/) | Place name from coordinates (reverse geocoding) | ⭐⭐⭐⭐ | N/A | N/A | N/A |

---

## Forecast Confidence

The Details page shows a confidence legend above the table (High › Medium › Low). The table is trimmed at the last 1-hour interval from MET's Locationforecast (typically ~48 hours), so only higher-confidence hourly data is displayed.

Beyond ~3 days the underlying NWP models are essentially providing climatological averages rather than genuine forecasts.

---

## Key Limitations

**Ocean data is coastal only.**
Barentswatch wave and current models cover Norwegian coastal waters. MET Norway's Oceanforecast (used for sea temperature) also covers coastal waters. The app suppresses ocean data when the nearest Barentswatch grid point is more than 1 km from the clicked location — this catches both inland points and locations at the edge of the model domain. When ocean data is suppressed, tide and score pages are also hidden. The forecast table shows only weather columns.

**Wave data is interpolated.**
Barentswatch provides wave data at 3-hour intervals. The app linearly interpolates wave height and direction to fill every hourly row. Interpolated values are displayed in grey italic to distinguish them from real data points. Between data points the interpolation is a reasonable approximation but cannot capture sudden changes.

**Tides are astronomical predictions only.**
Kartverket’s tide API returns the predicted astronomical tide — the component driven by the moon and sun. Storm surge (meteorological tide) is not included. During strong onshore winds or low-pressure systems, actual water levels can differ significantly from the prediction. Skippers must account for local conditions themselves.

**Weather accuracy beyond day 3–4.**
All NWP (numerical weather prediction) models lose skill rapidly beyond 3–4 days. The app trims the table at MET's last 1-hour interval (~48 hours), which keeps the forecast well within the reliable window. NoFish data is one input — local knowledge, VHF weather broadcasts, and personal judgment matter equally.

**Forecast grid points vs. clicked point.**
Both MET and Barentswatch APIs snap the requested coordinates to their nearest internal grid point. The Details page shows the distance from your clicked point to the actual wave forecast grid point used (when within 1 km). On the map, a sky-blue dot and dashed line indicate the wave grid point location. If the grid point is more than 1 km away, the ocean forecast is considered unrepresentative and is dropped entirely.

**Nominatim coverage at sea.**
OpenStreetMap’s reverse geocoder has variable coverage for open-water locations. The app uses a wide fallback chain (village → town → city → hamlet → bay → fjord → strait → sea → ocean → first segment of display name) before falling back to raw coordinates.

**Not a substitute for judgment.**
NoFish is not powered by AI and does not make recommendations. Every skipper on the Norwegian coast must use their own experience, local knowledge, and real intelligence before heading out on the water. The numbers here inform that decision — they do not replace it.

---

> See [readme-technical.md](readme-technical.md) for API endpoint details.
> See [readme-architecture.md](readme-architecture.md) for how these sources are fetched, merged, and cached.
